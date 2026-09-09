import { databaseNow } from "@/server/db/dialect";
import { and, desc, eq, sql } from "drizzle-orm";
import type { Executor } from "../db/client";
import { chatProposals } from "../db/schema";
import type { Actor } from "../auth/context";
import { errors } from "@/lib/errors";

export type TransactionProposalPayload = {
  accountId: string;
  accountName: string;
  name: string;
  amountLedgerMinor: number;
  currency: string;
  date: string;
  merchant: string | null;
  categoryId: string | null;
};

export type ChatProposalRow = typeof chatProposals.$inferSelect;

const TTL_MS = 10 * 60 * 1000;

export async function purgeExpiredProposals(exec: Executor): Promise<void> {
  await exec
    .update(chatProposals)
    .set({ status: "expired", updatedAt: new Date() })
    .where(
      and(eq(chatProposals.status, "pending"), sql`${chatProposals.expiresAt} < ${databaseNow}`)
    );
}

/**
 * Creates a pending proposal, dismissing any earlier pending one so a user has at
 * most one confirmable write at a time.
 */
export async function createProposal(
  exec: Executor,
  actor: Actor,
  payload: TransactionProposalPayload
): Promise<ChatProposalRow> {
  await purgeExpiredProposals(exec);
  await exec
    .update(chatProposals)
    .set({ status: "dismissed", updatedAt: new Date() })
    .where(and(eq(chatProposals.userId, actor.userId), eq(chatProposals.status, "pending")));
  const [row] = await exec
    .insert(chatProposals)
    .values({
      familyId: actor.familyId,
      userId: actor.userId,
      kind: "create_transaction",
      payload,
      expiresAt: new Date(Date.now() + TTL_MS)
    })
    .returning();
  if (!row) throw errors.conflict("Failed to create proposal.");
  return row;
}

export async function pendingProposal(
  exec: Executor,
  actor: Actor
): Promise<ChatProposalRow | null> {
  await purgeExpiredProposals(exec);
  const [row] = await exec
    .select()
    .from(chatProposals)
    .where(and(eq(chatProposals.userId, actor.userId), eq(chatProposals.status, "pending")))
    .orderBy(desc(chatProposals.createdAt))
    .limit(1);
  return row ?? null;
}

/**
 * Atomically flips a pending proposal to confirmed and returns its payload, so a
 * double-clicked confirm button can only ever execute one write. Returns null when
 * the proposal is unknown, expired, already resolved, or owned by another user.
 */
export async function claimProposalForConfirmation(
  exec: Executor,
  actor: Actor,
  proposalId: string
): Promise<TransactionProposalPayload | null> {
  await purgeExpiredProposals(exec);
  const rows = await exec
    .update(chatProposals)
    .set({ status: "confirmed", updatedAt: new Date() })
    .where(
      and(
        eq(chatProposals.id, proposalId),
        eq(chatProposals.userId, actor.userId),
        eq(chatProposals.familyId, actor.familyId),
        eq(chatProposals.status, "pending"),
        eq(chatProposals.kind, "create_transaction"),
        sql`${chatProposals.expiresAt} > ${databaseNow}`
      )
    )
    .returning({ payload: chatProposals.payload });
  const payload = rows[0]?.payload as TransactionProposalPayload | undefined;
  return payload ?? null;
}

export async function dismissProposal(
  exec: Executor,
  actor: Actor,
  proposalId: string
): Promise<boolean> {
  const rows = await exec
    .update(chatProposals)
    .set({ status: "dismissed", updatedAt: new Date() })
    .where(
      and(
        eq(chatProposals.id, proposalId),
        eq(chatProposals.userId, actor.userId),
        eq(chatProposals.status, "pending")
      )
    )
    .returning({ id: chatProposals.id });
  return rows.length > 0;
}
