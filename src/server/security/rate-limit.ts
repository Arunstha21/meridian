import { sql } from "drizzle-orm";
import { Executor } from "../db/client";
import { errors } from "@/lib/errors";

export async function consumeRateLimit(
  exec: Executor,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ remaining: number }> {
  const windowStartedAt = new Date(Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000);
  const res = await exec.execute<{ count: number }>(sql`
    INSERT INTO rate_limit_counters (bucket_key, window_started_at, count)
    VALUES (${key}, ${windowStartedAt.toISOString()}, 1)
    ON CONFLICT (bucket_key, window_started_at)
    DO UPDATE SET count = rate_limit_counters.count + 1
    RETURNING count
  `);
  const count = Number(res.rows?.[0]?.count ?? 1);
  if (count > limit) {
    throw errors.rateLimited();
  }
  return { remaining: Math.max(0, limit - count) };
}

export async function pruneRateLimitCounters(exec: Executor): Promise<number> {
  const res = await exec.execute(
    sql`DELETE FROM rate_limit_counters WHERE window_started_at < now() - interval '24 hours'`
  );
  return res.rowCount ?? 0;
}
