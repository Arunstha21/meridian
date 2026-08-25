"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, withTransaction } from "@/server/db/client";
import { assertActor } from "@/server/auth/context";
import { parseAmountToMinor } from "@/lib/money";
import { errors } from "@/lib/errors";
import { runAction, formValues, optionalString, type ActionState } from "@/server/actions/runner";
import * as valuationsSvc from "@/server/domain/valuations";
import * as orchestrate from "@/server/domain/orchestrate";

async function currencyFor(accountId: string): Promise<string> {
  const res = await getDb().execute<{ currency: string }>(
    sql`SELECT currency FROM accounts WHERE id = ${accountId}::uuid`
  );
  const row = (res.rows ?? [])[0];
  if (!row) throw errors.notFound("Account");
  return row.currency;
}

function toLedgerAmount(displayAmount: string, currency: string, kind: "expense" | "income"): number {
  const display = parseAmountToMinor(displayAmount, currency);
  return kind === "expense" ? Math.abs(display) : -Math.abs(display);
}

const createTxnSchema = z.object({
  accountId: z.string().uuid(),
  kind: z.enum(["expense", "income"]),
  date: z.string().min(8),
  amount: z.string().min(1),
  name: z.string().min(1).max(240),
  categoryId: z.string().optional(),
  merchant: z.string().optional(),
  notes: z.string().optional()
});

export async function createTransactionAction(
  _prev: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  const parsed = createTxnSchema.safeParse(formValues(formData));
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", code: "validation.failed" };
  const input = parsed.data;
  return runAction("txn.create", async () => {
    const actor = await assertActor();
    const currency = await currencyFor(input.accountId);
    await withTransaction(async (tx) => {
      await orchestrate.addTransaction(tx, actor, {
        accountId: input.accountId,
        date: input.date,
        amountLedgerMinor: toLedgerAmount(input.amount, currency, input.kind),
        name: input.name,
        categoryId: input.categoryId ? input.categoryId : null,
        merchant: optionalString(input.merchant),
        notes: optionalString(input.notes)
      });
    });
    revalidatePath("/transactions");
    revalidatePath("/");
    revalidatePath(`/accounts/${input.accountId}`);
    redirect("/transactions");
  });
}

const updateTxnSchema = z.object({
  entryId: z.string().uuid(),
  date: z.string().optional(),
  name: z.string().optional(),
  amount: z.string().optional(),
  ledgerSign: z.enum(["1", "-1"]).optional(),
  notes: z.string().optional(),
  merchant: z.string().optional(),
  categoryId: z.string().optional()
});

export async function updateTransactionAction(
  _prev: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  const parsed = updateTxnSchema.safeParse(formValues(formData));
  if (!parsed.success || !parsed.data.entryId) {
    return { ok: false, error: "Invalid request.", code: "validation.failed" };
  }
  const input = parsed.data;
  return runAction("txn.update", async () => {
    const actor = await assertActor();
    const patch: Record<string, unknown> = {};

    if (input.date) patch.date = input.date;
    if (input.name !== undefined && input.name.trim() !== "") patch.name = input.name;
    if (input.notes !== undefined) patch.notes = input.notes.trim() === "" ? null : input.notes;
    if (input.merchant !== undefined) patch.merchant = input.merchant.trim() === "" ? null : input.merchant;
    if (input.categoryId !== undefined) patch.categoryId = input.categoryId === "" ? null : input.categoryId;
    if (input.amount !== undefined && input.amount !== "" && input.ledgerSign) {
      const currency = await currencyForOfEntry(input.entryId);
      const magnitude = Math.abs(parseAmountToMinor(input.amount, currency));
      patch.amountLedgerMinor = input.ledgerSign === "-1" ? -magnitude : magnitude;
    }

    await withTransaction((tx) =>
      orchestrate.editTransaction(tx, actor, input.entryId, patch as Parameters<typeof orchestrate.editTransaction>[3])
    );
    revalidatePath("/transactions");
    revalidatePath("/");
    revalidatePath(`/transactions/${input.entryId}`);
    return undefined;
  });
}

async function currencyForOfEntry(entryId: string): Promise<string> {
  const res = await getDb().execute<{ currency: string }>(
    sql`SELECT currency FROM accounts WHERE id = (SELECT account_id FROM entries WHERE id = ${entryId}::uuid)`
  );
  return (res.rows ?? [])[0]?.currency ?? "USD";
}

export async function deleteEntryAction(formData: FormData): Promise<void> {
  "use server";
  const entryId = String(formData.get("entryId") ?? "");
  await runAction("txn.delete", async () => {
    const actor = await assertActor();
    await withTransaction((tx) => orchestrate.removeEntry(tx, actor, entryId));
    revalidatePath("/transactions");
    revalidatePath("/");
    redirect("/transactions");
  });
}

const splitPayloadSchema = z.object({
  parentEntryId: z.string().uuid(),
  parts: z
    .array(
      z.object({
        name: z.string().max(240).optional(),
        amountLedgerMinor: z.number().int(),
        categoryId: z.string().uuid().nullable().optional()
      })
    )
    .min(2)
});

export async function splitEntryAction(
  _prev: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  return runAction("txn.split", async () => {
    const json = String(formData.get("payload") ?? "");
    const input = splitPayloadSchema.parse(JSON.parse(json));
    const actor = await assertActor();
    await withTransaction((tx) => orchestrate.splitTransaction(tx, actor, input.parentEntryId, input.parts));
    revalidatePath("/transactions");
    revalidatePath(`/transactions/${input.parentEntryId}`);
    return undefined;
  });
}

export async function unsplitEntryAction(formData: FormData): Promise<void> {
  "use server";
  const parentEntryId = String(formData.get("parentEntryId") ?? "");
  await runAction("txn.unsplit", async () => {
    const actor = await assertActor();
    await withTransaction((tx) => orchestrate.unsplitTransaction(tx, actor, parentEntryId));
    revalidatePath("/transactions");
    revalidatePath(`/transactions/${parentEntryId}`);
  });
}

const linkTransferSchema = z.object({
  outflowEntryId: z.string().uuid(),
  inflowEntryId: z.string().uuid()
});

export async function linkTransferAction(
  _prev: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  return runAction("transfer.link", async () => {
    const input = linkTransferSchema.parse(formValues(formData));
    const actor = await assertActor();
    await withTransaction((tx) =>
      orchestrate.linkTransfer(tx, actor, input.outflowEntryId, input.inflowEntryId)
    );
    revalidatePath("/transactions");
    revalidatePath(`/transactions/${input.outflowEntryId}`);
    revalidatePath(`/transactions/${input.inflowEntryId}`);
    return undefined;
  });
}

export async function unlinkTransferAction(formData: FormData): Promise<void> {
  "use server";
  const transferId = String(formData.get("transferId") ?? "");
  const entryId = String(formData.get("entryId") ?? "");
  await runAction("transfer.unlink", async () => {
    const actor = await assertActor();
    await withTransaction((tx) => orchestrate.unlinkTransfer(tx, actor, transferId));
    revalidatePath("/transactions");
    if (entryId) revalidatePath(`/transactions/${entryId}`);
  });
}

const transferFormSchema = z.object({
  fromAccountId: z.string().uuid(),
  toAccountId: z.string().uuid(),
  date: z.string().min(8),
  amount: z.string().min(1),
  name: z.string().optional()
});

export async function createTransferAction(
  _prev: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  const parsed = transferFormSchema.safeParse(formValues(formData));
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", code: "validation.failed" };
  const input = parsed.data;
  return runAction("transfer.create", async () => {
    const actor = await assertActor();
    const currency = await currencyFor(input.fromAccountId);
    await withTransaction((tx) =>
      orchestrate.makeTransferWithEntries(tx, actor, {
        fromAccountId: input.fromAccountId,
        toAccountId: input.toAccountId,
        date: input.date,
        amountDisplayMinor: Math.abs(parseAmountToMinor(input.amount, currency)),
        name: input.name?.trim() ? input.name.trim() : undefined
      })
    );
    revalidatePath("/transactions");
    revalidatePath("/");
    redirect("/transactions");
  });
}

const valuationSchema = z.object({
  accountId: z.string().uuid(),
  date: z.string().min(8),
  amount: z.string().min(1),
  kind: z.enum(["current", "reconciliation", "opening"])
});

export async function recordValuationAction(
  _prev: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  const parsed = valuationSchema.safeParse(formValues(formData));
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", code: "validation.failed" };
  const input = parsed.data;
  return runAction("valuation.record", async () => {
    const actor = await assertActor();
    const currency = await currencyFor(input.accountId);
    const { recalculateAccount } = await import("@/server/domain/balances");
    await withTransaction(async (tx) => {
      await valuationsSvc.recordValuation(tx, actor, {
        accountId: input.accountId,
        date: input.date,
        amountDisplayMinor: Math.abs(parseAmountToMinor(input.amount, currency)),
        kind: input.kind
      });
      await recalculateAccount(tx, input.accountId, input.date);
    });
    revalidatePath(`/accounts/${input.accountId}`);
    revalidatePath("/");
    return undefined;
  });
}
