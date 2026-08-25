import { and, desc, eq, sql } from "drizzle-orm";
import { Executor } from "../db/client";
import { debugLogEntries } from "../db/schema";
import { redactDeep } from "@/lib/logger";

export type DebugLevel = "info" | "warn" | "error";

export async function captureDebugLog(
  exec: Executor,
  input: {
    category: string;
    level: DebugLevel;
    message: string;
    source?: string;
    providerKey?: string;
    familyId?: string | null;
    accountId?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await exec.insert(debugLogEntries).values({
    category: input.category,
    level: input.level,
    message: input.message,
    source: input.source ?? null,
    providerKey: input.providerKey ?? null,
    familyId: input.familyId ?? null,
    accountId: input.accountId ?? null,
    metadata: redactDeep(input.metadata ?? {}) ?? {}
  });
}

export async function listDebugLogs(
  exec: Executor,
  filter: { category?: string; level?: DebugLevel; limit?: number; offset?: number } = {}
) {
  const conditions = [];
  if (filter.category) conditions.push(eq(debugLogEntries.category, filter.category));
  if (filter.level) conditions.push(eq(debugLogEntries.level, filter.level));
  const where = conditions.length ? and(...conditions) : undefined;
  const rows = await exec
    .select()
    .from(debugLogEntries)
    .where(where)
    .orderBy(desc(debugLogEntries.createdAt))
    .limit(filter.limit ?? 100)
    .offset(filter.offset ?? 0);
  return rows;
}

export async function pruneDebugLogs(exec: Executor, olderThanDays: number): Promise<number> {
  const res = await exec.execute(
    sql`DELETE FROM debug_log_entries WHERE created_at < now() - (${String(olderThanDays)} || ' days')::interval`
  );
  return res.rowCount ?? 0;
}
