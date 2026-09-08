import { eq } from "drizzle-orm";
import type { Executor } from "../db/client";
import { accounts, entries, valuations } from "../db/schema";
import type { Actor } from "../auth/context";
import { assertAccountAccessLevel, assertAccountOpen } from "../authorization/access";
import { errors } from "@/lib/errors";
import { displayToLedgerBalance } from "@/lib/money";
import { isIsoDate } from "@/lib/datetime";
import { recordAudit } from "../observability/audit";

export const VALUATION_KINDS = ["opening", "reconciliation", "current"] as const;
export type ValuationKind = (typeof VALUATION_KINDS)[number];

export async function recordValuation(
  exec: Executor,
  actor: Actor,
  input: {
    accountId: string;
    date: string;
    amountDisplayMinor: number;
    kind?: ValuationKind;
    name?: string;
  }
): Promise<{ entryId: string }> {
  const level = await assertAccountAccessLevel(exec, actor, input.accountId);
  if (level !== "full_control") {
    throw errors.forbidden("Only full-control access can record valuations.");
  }
  await assertAccountOpen(exec, actor, input.accountId, "manage");
  if (!isIsoDate(input.date)) throw errors.validation("Date must be in YYYY-MM-DD format.");
  if (input.kind && !VALUATION_KINDS.includes(input.kind)) {
    throw errors.validation("Unknown valuation kind.");
  }

  const [account] = await exec.select().from(accounts).where(eq(accounts.id, input.accountId)).limit(1);
  if (!account) throw errors.notFound("Account");

  const name =
    input.name?.trim() ||
    (input.kind === "reconciliation" ? "Reconciliation adjustment" : "Valuation update");

  const ledgerAmount = displayToLedgerBalance(input.amountDisplayMinor, account.type);

  const entryId = await exec.transaction(async (tx) => {
    const [entry] = await tx
      .insert(entries)
      .values({
        accountId: account.id,
        date: input.date,
        amountMinor: ledgerAmount,
        currency: account.currency,
        name,
        entryableType: "valuation"
      })
      .returning({ id: entries.id });
    const entryId = entry?.id;
    if (!entryId) throw errors.conflict("Failed to create valuation entry.");
    await tx.insert(valuations).values({ entryId, kind: input.kind ?? "current" });
    return entryId;
  });

  await recordAudit(exec, {
    familyId: actor.familyId,
    actorUserId: actor.userId,
    action: "valuation.recorded",
    entityType: "entry",
    entityId: entryId,
    metadata: { accountId: account.id, kind: input.kind ?? "current" }
  });

  return { entryId };
}
