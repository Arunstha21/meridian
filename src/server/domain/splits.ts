import { and, asc, eq, sql } from "drizzle-orm";
import type { Executor } from "../db/client";
import { entries, transactions } from "../db/schema";
import type { Actor } from "../auth/context";
import {
  assertAccountOpen,
  canEditCore,
  assertAccountAccessLevel,
  getAccountAccess
} from "../authorization/access";
import { errors } from "@/lib/errors";
import { addMinor } from "@/lib/money";
import { recordAudit } from "../observability/audit";

export type SplitChildInput = {
  name?: string;
  amountLedgerMinor: number;
  categoryId?: string | null;
  tagIds?: string[];
};

export async function splitEntry(
  exec: Executor,
  actor: Actor,
  parentEntryId: string,
  children: SplitChildInput[]
): Promise<{ createdCount: number }> {
  if (!children || children.length < 2) {
    throw errors.validation("A split needs at least two parts.");
  }
  const [parent] = await exec.select().from(entries).where(eq(entries.id, parentEntryId)).limit(1);
  if (!parent || parent.entryableType !== "transaction") throw errors.notFound("Transaction");

  const access = await getAccountAccess(exec, actor, parent.accountId);
  if (!access.granted) throw errors.notFound("Transaction");
  if (!canEditCore(access.level)) {
    throw errors.forbidden("Your access level does not allow splitting transactions.");
  }
  await assertAccountOpen(exec, actor, parent.accountId, "manage");

  const [txn] = await exec
    .select({ transferId: transactions.transferId })
    .from(transactions)
    .where(eq(transactions.entryId, parentEntryId))
    .limit(1);
  if (txn?.transferId) {
    throw errors.conflict("Unlink the transfer before splitting this transaction.");
  }

  const [childCount] = await exec
    .select({ count: sql<number>`count(*)::int` })
    .from(entries)
    .where(eq(entries.parentEntryId, parentEntryId));
  if ((childCount?.count ?? 0) > 0) {
    throw errors.conflict("This transaction is already split.");
  }

  let sum = 0;
  for (const c of children) {
    if (c.amountLedgerMinor === 0) throw errors.validation("Split parts cannot be zero.");
    try {
      addMinor(0, c.amountLedgerMinor);
    } catch {
      throw errors.validation("A split part is outside the supported range.");
    }
    sum = addMinor(sum, c.amountLedgerMinor);
  }
  if (sum !== parent.amountMinor) {
    throw errors.validation(
      `Split parts must add up to the original amount (difference ${sum - parent.amountMinor} minor units).`
    );
  }

  await exec.transaction(async (tx) => {
    for (const c of children) {
      await tx.insert(entries).values({
        accountId: parent.accountId,
        parentEntryId: parent.id,
        date: parent.date,
        amountMinor: c.amountLedgerMinor,
        currency: parent.currency,
        name: c.name?.trim() || parent.name,
        entryableType: "transaction"
      });
    }
  });

  await recordAudit(exec, {
    familyId: actor.familyId,
    actorUserId: actor.userId,
    action: "entry.split",
    entityType: "entry",
    entityId: parentEntryId,
    metadata: { parts: children.length }
  });

  return { createdCount: children.length };
}

export async function unsplitEntry(exec: Executor, actor: Actor, parentEntryId: string): Promise<void> {
  const [parent] = await exec.select().from(entries).where(eq(entries.id, parentEntryId)).limit(1);
  if (!parent || parent.entryableType !== "transaction") throw errors.notFound("Transaction");
  const level = await assertAccountAccessLevel(exec, actor, parent.accountId);
  if (!canEditCore(level)) throw errors.forbidden();

  const removed = await exec.transaction(async (tx) => {
    const removedRows = await tx
      .delete(entries)
      .where(eq(entries.parentEntryId, parentEntryId))
      .returning({ id: entries.id });
    if (removedRows.length === 0) {
      throw errors.conflict("This transaction has no split parts.");
    }
    return removedRows.length;
  });

  await recordAudit(exec, {
    familyId: actor.familyId,
    actorUserId: actor.userId,
    action: "entry.unsplit",
    entityType: "entry",
    entityId: parentEntryId,
    metadata: { removedParts: removed }
  });
}

export async function listSplits(exec: Executor, actor: Actor, parentEntryId: string) {
  const loaded = await exec
    .select({ accountId: entries.accountId })
    .from(entries)
    .where(eq(entries.id, parentEntryId))
    .limit(1);
  if (!loaded[0]) throw errors.notFound("Transaction");
  const level = await assertAccountAccessLevel(exec, actor, loaded[0].accountId);
  if (!level) throw errors.forbidden();
  return exec
    .select({
      id: entries.id,
      name: entries.name,
      amountMinor: entries.amountMinor,
      categoryId: transactions.categoryId
    })
    .from(entries)
    .leftJoin(transactions, eq(transactions.entryId, entries.id))
    .where(and(eq(entries.parentEntryId, parentEntryId)))
    .orderBy(asc(entries.createdAt));
}
