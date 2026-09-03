import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Executor } from "../db/client";
import { categories, entries, tags, transactionTags, transactions } from "../db/schema";
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
    .select({
      transferId: transactions.transferId,
      merchant: transactions.merchant
    })
    .from(transactions)
    .where(eq(transactions.entryId, parentEntryId))
    .limit(1);
  if (!txn) throw errors.notFound("Transaction");
  if (txn.transferId) {
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

  const categoryIds = [...new Set(children.map((c) => c.categoryId).filter((id): id is string => Boolean(id)))];
  if (categoryIds.length > 0) {
    const rows = await exec
      .select({ id: categories.id })
      .from(categories)
      .where(and(inArray(categories.id, categoryIds), eq(categories.familyId, actor.familyId)));
    if (rows.length !== categoryIds.length) throw errors.validation("Unknown category.");
  }
  const tagIds = [...new Set(children.flatMap((c) => c.tagIds ?? []))];
  if (tagIds.length > 0) {
    const rows = await exec
      .select({ id: tags.id })
      .from(tags)
      .where(and(inArray(tags.id, tagIds), eq(tags.familyId, actor.familyId)));
    if (rows.length !== tagIds.length) throw errors.validation("Unknown tag.");
  }

  await exec.transaction(async (tx) => {
    for (const c of children) {
      const [child] = await tx
        .insert(entries)
        .values({
          accountId: parent.accountId,
          parentEntryId: parent.id,
          date: parent.date,
          amountMinor: c.amountLedgerMinor,
          currency: parent.currency,
          name: c.name?.trim() || parent.name,
          notes: parent.notes,
          entryableType: "transaction"
        })
        .returning({ id: entries.id });
      const childId = child?.id;
      if (!childId) throw errors.conflict("Failed to create split part.");
      const [childTxn] = await tx
        .insert(transactions)
        .values({
          entryId: childId,
          categoryId: c.categoryId ?? null,
          merchant: txn.merchant
        })
        .returning({ id: transactions.id });
      const childTxnId = childTxn?.id;
      if (!childTxnId) throw errors.conflict("Failed to create split transaction.");
      const partTags = [...new Set(c.tagIds ?? [])];
      if (partTags.length > 0) {
        await tx.insert(transactionTags).values(partTags.map((tagId) => ({ transactionId: childTxnId, tagId })));
      }
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
