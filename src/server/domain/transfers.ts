import { eq, sql } from "drizzle-orm";
import type { Executor } from "../db/client";
import { accounts, entries, transactions, transfers } from "../db/schema";
import type { Actor } from "../auth/context";
import { assertAccountAccess, assertAccountOpen } from "../authorization/access";
import { errors } from "@/lib/errors";
import { addMinor, negateMinor } from "@/lib/money";
import { diffDays, isIsoDate } from "@/lib/datetime";
import { recordAudit } from "../observability/audit";

export const TRANSFER_DATE_WINDOW_DAYS = 4;

export async function createTransferFromTransactions(
  exec: Executor,
  actor: Actor,
  outflowEntryId: string,
  inflowEntryId: string
): Promise<{ transferId: string; existing: boolean }> {
  if (outflowEntryId === inflowEntryId) {
    throw errors.validation("A transfer needs two different transactions.");
  }

  const rows = await exec
    .select({ entry: entries, account: accounts })
    .from(entries)
    .innerJoin(accounts, eq(accounts.id, entries.accountId))
    .where(sql`${entries.id} IN (${outflowEntryId}::uuid, ${inflowEntryId}::uuid)`);

  const outRow = rows.find((r) => r.entry.id === outflowEntryId);
  const inRow = rows.find((r) => r.entry.id === inflowEntryId);
  if (!outRow || !inRow) throw errors.notFound("Transaction");

  for (const row of [outRow, inRow]) {
    if (row.account.familyId !== actor.familyId) throw errors.notFound("Transaction");
    await assertAccountOpen(exec, actor, row.account.id, "manage");
  }
  if (outRow.account.familyId !== inRow.account.familyId) {
    throw errors.validation("Transfer legs must belong to the same family.");
  }
  if (outRow.entry.entryableType !== "transaction" || inRow.entry.entryableType !== "transaction") {
    throw errors.validation("Only transactions can be linked as a transfer.");
  }
  if (outRow.entry.parentEntryId || inRow.entry.parentEntryId) {
    throw errors.validation("Split parts cannot be linked as transfers. Split the whole transaction instead.");
  }
  if (outRow.account.id === inRow.account.id) {
    throw errors.validation("A transfer must move between two different accounts.");
  }
  if (outRow.account.currency !== inRow.account.currency) {
    throw errors.validation("Cross-currency transfers are not supported yet.");
  }
  const [existingOut] = await exec
    .select({ transferId: transactions.transferId })
    .from(transactions)
    .where(eq(transactions.entryId, outflowEntryId))
    .limit(1);
  const [existingIn] = await exec
    .select({ transferId: transactions.transferId })
    .from(transactions)
    .where(eq(transactions.entryId, inflowEntryId))
    .limit(1);
  if (existingOut?.transferId && existingOut.transferId === existingIn?.transferId) {
    return { transferId: existingOut.transferId, existing: true };
  }
  if (existingOut?.transferId || existingIn?.transferId) {
    throw errors.conflict("One of these transactions is already part of a transfer.");
  }

  const out = outRow.entry;
  const inn = inRow.entry;
  if (out.amountMinor <= 0 || inn.amountMinor >= 0) {
    throw errors.validation("Pick the outgoing transaction and the incoming one — their amounts must oppose each other.");
  }
  if (addMinor(out.amountMinor, inn.amountMinor) !== 0) {
    throw errors.validation("Transfer amounts must match exactly.");
  }
  if (!isIsoDate(out.date) || !isIsoDate(inn.date)) {
    throw errors.validation("Invalid entry date.");
  }
  if (Math.abs(diffDays(out.date, inn.date)) > TRANSFER_DATE_WINDOW_DAYS) {
    throw errors.validation(
      `Transfer legs must be within ${TRANSFER_DATE_WINDOW_DAYS} days of each other.`
    );
  }

  const transferId = await exec.transaction(async (tx) => {
    const [transfer] = await tx
      .insert(transfers)
      .values({ outflowEntryId, inflowEntryId })
      .returning({ id: transfers.id });
    const tid = transfer!.id;
    await tx.update(transactions).set({ transferId: tid }).where(eq(transactions.entryId, outflowEntryId));
    await tx.update(transactions).set({ transferId: tid }).where(eq(transactions.entryId, inflowEntryId));
    return tid;
  });

  await recordAudit(exec, {
    familyId: actor.familyId,
    actorUserId: actor.userId,
    action: "transfer.created",
    entityType: "transfer",
    entityId: transferId,
    metadata: { outflowEntryId, inflowEntryId }
  });

  return { transferId, existing: false };
}

export type CreateTransferInput = {
  fromAccountId: string;
  toAccountId: string;
  date: string;
  amountDisplayMinor: number;
  name?: string;
};

export async function createTransferWithNewEntries(
  exec: Executor,
  actor: Actor,
  input: CreateTransferInput
): Promise<{ transferId: string }> {
  if (input.fromAccountId === input.toAccountId) {
    throw errors.validation("Choose two different accounts.");
  }
  if (input.amountDisplayMinor <= 0) throw errors.validation("Transfer amount must be positive.");

  const from = await assertAccountOpen(exec, actor, input.fromAccountId, "manage");
  const to = await assertAccountOpen(exec, actor, input.toAccountId, "manage");
  if (from.account.familyId !== to.account.familyId) throw errors.forbidden();
  if (from.account.currency !== to.account.currency) {
    throw errors.validation("Cross-currency transfers are not supported yet.");
  }
  if (!isIsoDate(input.date)) throw errors.validation("Date must be in YYYY-MM-DD format.");

  const name = input.name?.trim() || `Transfer to ${to.account.name}`;
  const amount = input.amountDisplayMinor;

  const transferId = await exec.transaction(async (tx) => {
    const [out] = await tx
      .insert(entries)
      .values({
        accountId: from.account.id,
        date: input.date,
        amountMinor: amount,
        currency: from.account.currency,
        name,
        entryableType: "transaction"
      })
      .returning({ id: entries.id });
    const [inn] = await tx
      .insert(entries)
      .values({
        accountId: to.account.id,
        date: input.date,
        amountMinor: negateMinor(amount),
        currency: to.account.currency,
        name: `Transfer from ${from.account.name}`,
        entryableType: "transaction"
      })
      .returning({ id: entries.id });
    const [txnOut] = await tx
      .insert(transactions)
      .values({ entryId: out!.id })
      .returning({ id: transactions.id });
    const [txnIn] = await tx
      .insert(transactions)
      .values({ entryId: inn!.id })
      .returning({ id: transactions.id });
    const [transfer] = await tx
      .insert(transfers)
      .values({ outflowEntryId: out!.id, inflowEntryId: inn!.id })
      .returning({ id: transfers.id });
    await tx
      .update(transactions)
      .set({ transferId: transfer!.id })
      .where(eq(transactions.id, txnOut!.id));
    await tx
      .update(transactions)
      .set({ transferId: transfer!.id })
      .where(eq(transactions.id, txnIn!.id));
    return transfer!.id;
  });

  await recordAudit(exec, {
    familyId: actor.familyId,
    actorUserId: actor.userId,
    action: "transfer.created",
    entityType: "transfer",
    entityId: transferId,
    metadata: { from: from.account.id, to: to.account.id, amountDisplayMinor: amount }
  });

  return { transferId };
}

export async function removeTransfer(exec: Executor, actor: Actor, transferId: string): Promise<void> {
  const [transfer] = await exec.select().from(transfers).where(eq(transfers.id, transferId)).limit(1);
  if (!transfer) throw errors.notFound("Transfer");

  const legs = await exec
    .select({ accountId: entries.accountId })
    .from(entries)
    .where(sql`${entries.id} IN (${transfer.outflowEntryId}::uuid, ${transfer.inflowEntryId}::uuid)`);

  let familyId: string | null = null;
  for (const leg of legs) {
    const [acc] = await exec.select().from(accounts).where(eq(accounts.id, leg.accountId)).limit(1);
    if (!acc || acc.familyId !== actor.familyId) throw errors.forbidden();
    await assertAccountAccess(exec, actor, acc.id, "manage");
    familyId = actor.familyId;
  }

  await exec.transaction(async (tx) => {
    await tx.update(transactions).set({ transferId: null }).where(eq(transactions.transferId, transferId));
    await tx.delete(transfers).where(eq(transfers.id, transferId));
  });

  await recordAudit(exec, {
    familyId,
    actorUserId: actor.userId,
    action: "transfer.removed",
    entityType: "transfer",
    entityId: transferId
  });
}

export type TransferCandidate = {
  entryId: string;
  date: string;
  name: string;
  amountMinor: number;
  accountName: string;
};

export async function suggestTransferMatches(
  exec: Executor,
  actor: Actor,
  entryId: string
): Promise<TransferCandidate[]> {
  const [base] = await exec
    .select({ entry: entries, account: accounts })
    .from(entries)
    .innerJoin(accounts, eq(accounts.id, entries.accountId))
    .where(eq(entries.id, entryId))
    .limit(1);
  if (!base || base.account.familyId !== actor.familyId) throw errors.notFound("Transaction");
  if (base.entry.entryableType !== "transaction") return [];
  const [baseTxn] = await exec
    .select({ transferId: transactions.transferId })
    .from(transactions)
    .where(eq(transactions.entryId, entryId))
    .limit(1);
  if (baseTxn?.transferId) return [];

  const sign = base.entry.amountMinor > 0 ? -1 : 1;
  const res = await exec.execute<{
    id: string;
    date: string;
    name: string;
    amount_minor: string;
    account_name: string;
  }>(sql`
    SELECT e.id, e.date::text AS date, e.name, e.amount_minor::text AS amount_minor, a.name AS account_name
    FROM entries e
    JOIN accounts a ON a.id = e.account_id
    JOIN transactions t ON t.entry_id = e.id
    WHERE a.family_id = ${actor.familyId}
      AND e.entryable_type = 'transaction'
      AND e.id <> ${entryId}::uuid
      AND e.parent_entry_id IS NULL
      AND t.transfer_id IS NULL
      AND sign(e.amount_minor) = ${sign}
      AND e.date BETWEEN ${base.entry.date}::date - ${String(TRANSFER_DATE_WINDOW_DAYS)}::int
                    AND ${base.entry.date}::date + ${String(TRANSFER_DATE_WINDOW_DAYS)}::int
      AND (
        a.owner_id IS NULL OR a.owner_id = ${actor.userId}
        OR EXISTS (SELECT 1 FROM account_shares s WHERE s.account_id = a.id AND s.user_id = ${actor.userId})
      )
      AND abs(e.amount_minor) = ${Math.abs(base.entry.amountMinor)}
    ORDER BY abs(e.date - ${base.entry.date}::date), abs(e.amount_minor - ${Math.abs(base.entry.amountMinor)})
    LIMIT 10
  `);

  return (res.rows ?? []).map((r) => ({
    entryId: r.id,
    date: r.date.slice(0, 10),
    name: r.name,
    amountMinor: Math.abs(Number(r.amount_minor)),
    accountName: r.account_name
  }));
}
