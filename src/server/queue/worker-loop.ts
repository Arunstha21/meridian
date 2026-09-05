import { sql } from "drizzle-orm";
import type { Executor } from "../db/client";
import { nextCronRun } from "./cron";

export { recoverStaleJobs, claimBatch, completeJob, failJob } from "./index";

export type CronDef = {
  key: string;
  queue: string;
  payload?: Record<string, unknown>;
  cron: string;
};

export async function ensureSchedules(exec: Executor, defs: CronDef[]): Promise<void> {
  for (const def of defs) {
    const res = await exec.execute<{ id: string }>(sql`
      INSERT INTO cron_schedules (key, queue, payload, cron, next_run_at)
      VALUES (${def.key}, ${def.queue}, ${JSON.stringify(def.payload ?? {})}::jsonb, ${def.cron},
              ${nextCronRun(def.cron, new Date()).toISOString()})
      ON CONFLICT (key) DO UPDATE SET queue = EXCLUDED.queue, cron = EXCLUDED.cron,
        payload = EXCLUDED.payload, enabled = true
      RETURNING key::text AS id
    `);
    void res;
  }
}

export async function runDueCrons(exec: Executor): Promise<number> {
  return exec.transaction(async (tx) => {
    const due = await tx.execute<{
      key: string;
      queue: string;
      payload: Record<string, unknown>;
      cron: string;
      next_run_at: string;
    }>(sql`
      SELECT key, queue, payload, cron, next_run_at
      FROM cron_schedules
      WHERE enabled = true AND next_run_at <= now()
      FOR UPDATE SKIP LOCKED
    `);

    let fired = 0;
    for (const row of due.rows ?? []) {
      const dedupeKey = `${row.key}:${new Date(row.next_run_at).toISOString()}`;
      const enq = await tx.execute(sql`
        INSERT INTO jobs (queue, payload, dedupe_key)
        VALUES (${row.queue}, ${JSON.stringify(row.payload)}::jsonb, ${dedupeKey})
        ON CONFLICT DO NOTHING
        RETURNING id::text AS id
      `);
      if ((enq.rowCount ?? 0) > 0) fired++;
      const prevMs = new Date(row.next_run_at).getTime();
      const base = new Date(Math.max(Date.now(), prevMs));
      const advanced = nextCronRun(row.cron, base);
      await tx.execute(sql`
        UPDATE cron_schedules
        SET last_run_at = now(), next_run_at = ${advanced.toISOString()}
        WHERE key = ${row.key}
      `);
    }
    return fired;
  });
}
