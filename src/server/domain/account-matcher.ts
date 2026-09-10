import { and, eq } from "drizzle-orm";
import type { Executor } from "../db/client";
import { accounts } from "../db/schema";

export type AccountRow = typeof accounts.$inferSelect;

export type MatchAccountHints = {
  preferredAccountId?: string | null;
  bankName?: string | null;
  accountDigits?: string | null;
  accountNumber?: string | null;
  sender?: string | null;
  rawText?: string | null;
};

export type MatchAccountResult = {
  account: AccountRow;
  matchedBy:
    | "explicit_id"
    | "institution"
    | "account_name"
    | "account_number"
    | "sender"
    | "text_mention"
    | "fallback_default";
};

export async function matchAccountForSms(
  exec: Executor,
  familyId: string,
  hints: MatchAccountHints
): Promise<MatchAccountResult | null> {
  const allAccounts = await exec
    .select()
    .from(accounts)
    .where(and(eq(accounts.familyId, familyId), eq(accounts.status, "active")));

  if (allAccounts.length === 0) {
    return null;
  }

  // 1. Explicit ID
  if (hints.preferredAccountId) {
    const direct = allAccounts.find((a) => a.id === hints.preferredAccountId);
    if (direct) {
      return { account: direct, matchedBy: "explicit_id" };
    }
  }

  // 2. Match by Account Number / Digits (e.g. "02167", "9850", "88011052")
  const digits =
    hints.accountDigits ||
    (hints.accountNumber ? hints.accountNumber.replace(/[^0-9]/g, "") : null);
  if (digits && digits.length >= 3) {
    const digitMatch = allAccounts.find((a) => {
      const name = a.name.toLowerCase();
      const ext = a.externalId?.toLowerCase() ?? "";
      return name.includes(digits) || ext.includes(digits);
    });
    if (digitMatch) {
      return { account: digitMatch, matchedBy: "account_number" };
    }
  }

  // 3. Match by Bank Name
  if (hints.bankName) {
    const bankClean = hints.bankName.trim().toLowerCase();

    // Check institution
    const institutionMatch = allAccounts.find((a) => {
      if (!a.institution) return false;
      const inst = a.institution.toLowerCase();
      return inst.includes(bankClean) || bankClean.includes(inst);
    });
    if (institutionMatch) {
      return { account: institutionMatch, matchedBy: "institution" };
    }

    // Check account name
    const nameMatch = allAccounts.find((a) => {
      const name = a.name.toLowerCase();
      return name.includes(bankClean) || bankClean.includes(name);
    });
    if (nameMatch) {
      return { account: nameMatch, matchedBy: "account_name" };
    }
  }

  // 4. Match by Sender
  if (hints.sender) {
    const senderClean = hints.sender.toLowerCase().replace(/[^a-z0-9]/g, "");
    const senderMatch = allAccounts.find((a) => {
      const inst = (a.institution ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const name = a.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      return (
        (inst && (senderClean.includes(inst) || inst.includes(senderClean))) ||
        (name && (senderClean.includes(name) || name.includes(senderClean)))
      );
    });
    if (senderMatch) {
      return { account: senderMatch, matchedBy: "sender" };
    }
  }

  // 5. Match by any account's institution appearing in raw text
  if (hints.rawText) {
    const bodyClean = hints.rawText.toLowerCase();
    const textMatch = allAccounts.find((a) => {
      if (!a.institution) return false;
      const inst = a.institution.toLowerCase().trim();
      return inst.length > 2 && bodyClean.includes(inst);
    });
    if (textMatch) {
      return { account: textMatch, matchedBy: "text_mention" };
    }
  }

  // 6. Fallback: First depository (cash / checking) or first active account
  const fallback = allAccounts.find((a) => a.type === "depository") || allAccounts[0];

  if (!fallback) {
    return null;
  }

  return {
    account: fallback,
    matchedBy: "fallback_default"
  };
}
