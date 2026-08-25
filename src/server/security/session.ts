import { and, eq, gt, lt, ne } from "drizzle-orm";
import { Executor } from "../db/client";
import { sessions } from "../db/schema";
import { hashToken, randomToken } from "@/lib/crypto";
import { redactDeep } from "@/lib/logger";

export const SESSION_TTL_DAYS = 30;
const TOUCH_THRESHOLD_MS = 60 * 60 * 1000;

export type SessionRow = typeof sessions.$inferSelect;

export async function createSession(
  exec: Executor,
  userId: string,
  meta: { ip?: string | null; userAgent?: string | null }
): Promise<{ token: string; session: SessionRow }> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  const [session] = await exec
    .insert(sessions)
    .values({
      userId,
      tokenHash: hashToken(token),
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      expiresAt
    })
    .returning();
  return { token, session: session! };
}

export async function findLiveSession(exec: Executor, token: string): Promise<SessionRow | null> {
  const tokenHash = hashToken(token);
  const [row] = await exec
    .select()
    .from(sessions)
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

export async function touchSession(exec: Executor, session: SessionRow): Promise<void> {
  const stale = Date.now() - session.lastUsedAt.getTime() > TOUCH_THRESHOLD_MS;
  if (!stale) return;
  const nextExpiry = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  await exec
    .update(sessions)
    .set({ lastUsedAt: new Date(), expiresAt: nextExpiry })
    .where(eq(sessions.id, session.id));
}

export async function revokeSession(exec: Executor, sessionId: string): Promise<void> {
  await exec.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function revokeOtherSessions(exec: Executor, userId: string, keepSessionId?: string) {
  const where = keepSessionId
    ? and(eq(sessions.userId, userId), ne(sessions.id, keepSessionId))
    : eq(sessions.userId, userId);
  const removed = await exec.delete(sessions).where(where).returning({ id: sessions.id });
  return removed.length;
}

export async function revokeAllSessions(exec: Executor, userId: string): Promise<number> {
  return revokeOtherSessions(exec, userId);
}

export async function purgeExpiredSessions(exec: Executor): Promise<number> {
  const removed = await exec
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date()))
    .returning({ id: sessions.id });
  return removed.length;
}

export function describeSession(session: SessionRow) {
  return redactDeep({
    id: session.id,
    created: session.createdAt,
    lastUsed: session.lastUsedAt,
    expires: session.expiresAt,
    ip: session.ip,
    userAgent: session.userAgent
  });
}
