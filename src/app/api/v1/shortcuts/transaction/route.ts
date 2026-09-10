import { NextResponse } from "next/server";
import { authenticateApiRequest } from "@/server/auth/api-auth";
import { getDb, withTransaction } from "@/server/db/client";
import { parseSms } from "@/server/domain/sms-parser";
import { matchAccountForSms } from "@/server/domain/account-matcher";
import { addTransaction } from "@/server/domain/orchestrate";
import { categories } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import { minorToMajor } from "@/lib/money";

export async function POST(req: Request) {
  try {
    const actor = await authenticateApiRequest(req);
    const body = await req.json().catch(() => ({}));

    // Accept various common parameter names from Shortcuts/Tasker
    const rawSms = (body.rawSms ?? body.sms ?? body.message ?? body.body ?? "").toString().trim();
    const sender = (body.sender ?? body.from ?? "").toString().trim();
    const userPromptNote = (body.name ?? body.note ?? body.description ?? "").toString().trim();

    // 1. Parse SMS if provided
    const parsedSms = rawSms ? parseSms(rawSms, sender || null) : null;

    // 2. Resolve Amount
    let amountMinor = 0;
    if (body.amount !== undefined && body.amount !== null && body.amount !== "") {
      const parsedAmount =
        typeof body.amount === "number"
          ? body.amount
          : parseFloat(String(body.amount).replace(/,/g, ""));
      if (!isNaN(parsedAmount) && parsedAmount > 0) {
        amountMinor = Math.round(parsedAmount * 100);
      }
    } else if (parsedSms && parsedSms.amountMinor > 0) {
      amountMinor = parsedSms.amountMinor;
    }

    if (amountMinor <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Could not determine transaction amount. Please provide an amount or SMS text."
        },
        { status: 400 }
      );
    }

    // 3. Resolve Kind (expense vs income)
    let kind: "expense" | "income" = "expense";
    const explicitKind = (body.kind ?? body.type ?? "").toString().toLowerCase();
    if (["income", "credit", "cr", "deposit"].includes(explicitKind)) {
      kind = "income";
    } else if (["expense", "debit", "dr", "withdrawal"].includes(explicitKind)) {
      kind = "expense";
    } else if (parsedSms) {
      kind = parsedSms.kind;
    }

    // 4. Resolve Account & Match
    const db = getDb();
    const matchResult = await matchAccountForSms(db, actor.familyId, {
      preferredAccountId: body.accountId || null,
      bankName: body.bank || parsedSms?.bankName || null,
      accountDigits: parsedSms?.accountDigits || null,
      accountNumber: parsedSms?.accountNumber || null,
      sender: sender || null,
      rawText: rawSms || null
    });

    if (!matchResult) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No active accounts found in your Meridian profile. Please create an account first."
        },
        { status: 400 }
      );
    }

    const { account, matchedBy } = matchResult;

    // 5. Resolve Date
    let date = body.date
      ? String(body.date).trim()
      : parsedSms?.date || new Date().toISOString().slice(0, 10);
    // Verify YYYY-MM-DD format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      date = new Date().toISOString().slice(0, 10);
    }

    // 6. Resolve Category
    let categoryId: string | null = null;
    let categoryName: string | null = null;

    if (body.categoryId) {
      const [cat] = await db
        .select()
        .from(categories)
        .where(and(eq(categories.id, body.categoryId), eq(categories.familyId, actor.familyId)))
        .limit(1);
      if (cat) {
        categoryId = cat.id;
        categoryName = cat.name;
      }
    } else if (body.category) {
      const catInput = String(body.category).trim().toLowerCase();
      const allCats = await db
        .select()
        .from(categories)
        .where(eq(categories.familyId, actor.familyId));
      const found = allCats.find((c) => c.name.toLowerCase() === catInput);
      if (found) {
        categoryId = found.id;
        categoryName = found.name;
      }
    }

    // 7. Resolve Description / Name
    // User prompt input ("What was this for?") takes precedence, followed by remarks / merchant / fallback
    let name = userPromptNote;
    if (!name) {
      if (parsedSms?.remarks) {
        name = parsedSms.remarks;
      } else if (parsedSms?.bankName) {
        name = `${parsedSms.bankName} ${kind === "expense" ? "Payment" : "Deposit"}`;
      } else {
        name = `${account.name} ${kind === "expense" ? "Expense" : "Income"}`;
      }
    }

    // 8. Notes & Paper Trail
    const noteParts: string[] = [];
    if (body.notes) noteParts.push(String(body.notes).trim());
    if (rawSms) noteParts.push(`[SMS Alert]\n${rawSms}`);
    const notes = noteParts.length > 0 ? noteParts.join("\n\n") : null;

    // 9. Sign convention: Meridian uses POSITIVE for expenses, NEGATIVE for income
    const amountLedgerMinor = kind === "expense" ? Math.abs(amountMinor) : -Math.abs(amountMinor);

    // 10. Deduplication key
    const externalId = body.externalId || parsedSms?.referenceId || null;

    // 11. Create the Transaction
    let result: { entryId: string; duplicated: boolean };
    try {
      result = await withTransaction(async (tx) => {
        return addTransaction(tx, actor, {
          accountId: account.id,
          date,
          amountLedgerMinor,
          name,
          categoryId,
          merchant: parsedSms?.merchant || null,
          notes,
          externalSource: "sms_shortcut",
          externalId
        });
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to record transaction.";
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      duplicated: result.duplicated,
      message: result.duplicated
        ? "Transaction already recorded (duplicate detected)."
        : "Transaction successfully recorded.",
      entry: {
        id: result.entryId,
        name,
        amount: minorToMajor(amountMinor, account.currency),
        currency: account.currency,
        kind,
        date,
        account: {
          id: account.id,
          name: account.name,
          institution: account.institution,
          matchedBy
        },
        category: categoryName
      }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error.";
    const status = msg.includes("unauthorized") || msg.includes("API key") ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
