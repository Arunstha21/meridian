import { sql } from "drizzle-orm";
import type { Executor } from "../db/client";
import type { Actor } from "../auth/context";
import * as entriesSvc from "./entries";
import * as splitsSvc from "./splits";
import * as transfersSvc from "./transfers";
import { recalculateAccount } from "./balances";

export async function addTransaction(exec: Executor, actor: Actor, input: entriesSvc.TransactionEntryInput) {
  const res = await entriesSvc.createTransactionEntry(exec, actor, input);
  if (!res.duplicated) await recalculateAccount(exec, input.accountId, input.date);
  return res;
}

export async function editTransaction(
  exec: Executor,
  actor: Actor,
  entryId: string,
  patch: entriesSvc.EntryUpdatePatch
) {
  const res = await entriesSvc.updateTransactionEntry(exec, actor, entryId, patch);
  await recalculateAccount(
    exec,
    await accountIdForEntry(exec, entryId),
    res.oldDate <= res.newDate ? res.oldDate : res.newDate
  );
  return res;
}

export async function removeEntry(exec: Executor, actor: Actor, entryId: string) {
  const accountId = await accountIdForEntry(exec, entryId);
  const date = await entryDateFor(exec, entryId);
  await entriesSvc.deleteEntry(exec, actor, entryId);
  if (accountId) await recalculateAccount(exec, accountId, date ?? undefined);
}

export async function splitTransaction(
  exec: Executor,
  actor: Actor,
  parentEntryId: string,
  children: splitsSvc.SplitChildInput[]
) {
  const res = await splitsSvc.splitEntry(exec, actor, parentEntryId, children);
  await recalculateAccount(exec, await accountIdForEntry(exec, parentEntryId));
  return res;
}

export async function unsplitTransaction(exec: Executor, actor: Actor, parentEntryId: string) {
  await splitsSvc.unsplitEntry(exec, actor, parentEntryId);
  await recalculateAccount(exec, await accountIdForEntry(exec, parentEntryId));
}

export async function linkTransfer(
  exec: Executor,
  actor: Actor,
  outflowEntryId: string,
  inflowEntryId: string
) {
  const res = await transfersSvc.createTransferFromTransactions(exec, actor, outflowEntryId, inflowEntryId);
  if (!res.existing) {
    for (const id of [outflowEntryId, inflowEntryId]) {
      await recalculateAccount(exec, await accountIdForEntry(exec, id));
    }
  }
  return res;
}

export async function unlinkTransfer(exec: Executor, actor: Actor, transferId: string) {
  const legs = await transferLegAccounts(exec, transferId);
  await transfersSvc.removeTransfer(exec, actor, transferId);
  for (const accountId of legs) {
    await recalculateAccount(exec, accountId);
  }
}

export async function makeTransferWithEntries(
  exec: Executor,
  actor: Actor,
  input: transfersSvc.CreateTransferInput
) {
  const res = await transfersSvc.createTransferWithNewEntries(exec, actor, input);
  await recalculateAccount(exec, input.fromAccountId, input.date);
  await recalculateAccount(exec, input.toAccountId, input.date);
  return res;
}

async function accountIdForEntry(exec: Executor, entryId: string): Promise<string> {
  const res = await exec.execute<{ account_id: string }>(
    sql`SELECT account_id::text AS account_id FROM entries WHERE id = ${entryId}::uuid`
  );
  return (res.rows ?? [])[0]?.account_id ?? "";
}

async function entryDateFor(exec: Executor, entryId: string): Promise<string | null> {
  const res = await exec.execute<{ date: string }>(
    sql`SELECT date::text AS date FROM entries WHERE id = ${entryId}::uuid`
  );
  const d = (res.rows ?? [])[0]?.date;
  return d ? d.slice(0, 10) : null;
}

async function transferLegAccounts(exec: Executor, transferId: string): Promise<string[]> {
  const res = await exec.execute<{ account_id: string }>(
    sql`
      SELECT DISTINCT e.account_id::text AS account_id
      FROM transfers t
      JOIN entries e ON e.id IN (t.outflow_entry_id, t.inflow_entry_id)
      WHERE t.id = ${transferId}::uuid
    `
  );
  return (res.rows ?? []).map((r) => r.account_id);
}
