import { NextResponse } from "next/server";
import { authenticateApiRequest } from "@/server/auth/api-auth";
import { getDb } from "@/server/db/client";
import { parseSms } from "@/server/domain/sms-parser";
import { matchAccountForSms } from "@/server/domain/account-matcher";

export async function POST(req: Request) {
  try {
    const actor = await authenticateApiRequest(req);
    const body = await req.json().catch(() => ({}));

    const rawSms = (body.rawSms ?? body.sms ?? body.message ?? body.body ?? "").toString().trim();
    const sender = (body.sender ?? body.from ?? "").toString().trim();

    if (!rawSms) {
      return NextResponse.json(
        { ok: false, error: "Please provide 'rawSms' or 'sms' in the request body." },
        { status: 400 }
      );
    }

    const parsed = parseSms(rawSms, sender || null);
    const db = getDb();
    const match = await matchAccountForSms(db, actor.familyId, {
      preferredAccountId: body.accountId || null,
      bankName: body.bank || parsed.bankName || null,
      accountDigits: parsed.accountDigits,
      accountNumber: parsed.accountNumber,
      sender: sender || null,
      rawText: rawSms
    });

    return NextResponse.json({
      ok: true,
      parsed: {
        amountMajor: parsed.amountMajor,
        amountMinor: parsed.amountMinor,
        currency: parsed.currency,
        kind: parsed.kind,
        date: parsed.date,
        accountNumber: parsed.accountNumber,
        accountDigits: parsed.accountDigits,
        bankName: parsed.bankName,
        remarks: parsed.remarks,
        merchant: parsed.merchant,
        referenceId: parsed.referenceId
      },
      accountMatch: match
        ? {
            id: match.account.id,
            name: match.account.name,
            institution: match.account.institution,
            matchedBy: match.matchedBy
          }
        : null
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error.";
    const status = msg.includes("unauthorized") || msg.includes("API key") ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
