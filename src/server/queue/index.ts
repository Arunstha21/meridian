import { sql } from "drizzle-orm";
import type { Executor } from "../db/client";
import { jobs } from "../db/schema";
import { captureDebugLog } from "../observability/debug-log";

export type JobPayload = Record<string, unknown>;

export type JobHandler = (payload: JobPayload, exec: Executor) => Promise<void>;
export type HandlerRegistry = Map<string, JobHandler>;

export type EnqueueOptions = {
  dedupeKey?: string;
  maxAttempts?: number;
  delaySeconds?: number;
};

export async function enqueue(
  exec: Executor,
  queue: string,
  payload: JobPayload,
  opts: EnqueueOptions = {}
): Promise<string | null> {
  const values = {
    queue,
    payload,
    dedupeKey: opts.dedupeKey ?? null,
    maxAttempts: opts.maxAttempts ?? 5,
    ...(opts.delaySeconds ? { runAfter: new Date(Date.now() + opts.delaySeconds * 1000) } : {})
  };
  const rows = await exec.insert(jobs).values(values).onConflictDoNothing().returning({ id: jobs.id });
  return rows[0]?.id ?? null;
}

export type ClaimedJob = typeof jobs.$inferSelect;

const STALE_LOCK_MINUTES = 10;

export async function recoverStaleJobs(exec: Executor): Promise<number> {
  const res = await exec.execute(sql`
    UPDATE jobs SET status = 'pending', locked_at = NULL, locked_by = NULL, updated_at = now()
    WHERE status = 'running' AND locked_at < now() - (${String(STALE_LOCK_MINUTES)} || ' minutes')::interval
  `);
  return res.rowCount ?? 0;
}

export async function claimBatch(exec: Executor, workerName: string, limit: number): Promise<ClaimedJob[]> {
  const res = await exec.execute(sql`
    UPDATE jobs SET status = 'running', locked_by = ${workerName}, locked_at = now(),
      attempts = attempts + 1, updated_at = now()
    WHERE id IN (
      SELECT id FROM jobs
      WHERE status = 'pending' AND run_after <= now()
      ORDER BY created_at
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, queue, payload, dedupe_key AS "dedupeKey", status, attempts,
      max_attempts AS "maxAttempts", run_after AS "runAfter", locked_at AS "lockedAt",
      locked_by AS "lockedBy", last_error AS "lastError", completed_at AS "completedAt",
      created_at AS "createdAt", updated_at AS "updatedAt"
  `);
  return (res.rows ?? []) as ClaimedJob[];
}

function backoffSeconds(attempts: number): number {
  return Math.min(3600, 2 ** Math.max(0, attempts - 1) * 5);
}

export async function completeJob(exec: Executor, jobId: string): Promise<void> {
  await exec.execute(sql`
    UPDATE jobs SET status = 'completed', completed_at = now(), updated_at = now(), last_error = NULL
    WHERE id = ${jobId}
  `);
}

export async function failJob(exec: Executor, job: ClaimedJob, error: unknown): Promise<"retry" | "dead"> {
  const message =
    error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 500) : String(error).slice(0, 500);
  if (job.attempts >= job.maxAttempts) {
    await exec.execute(sql`
      UPDATE jobs SET status = 'dead', last_error = ${message}, updated_at = now() WHERE id = ${job.id}
    `);
    await captureDebugLog(exec, {
      category: "jobs",
      level: "error",
      message: `Job ${job.queue} moved to dead-letter after ${job.attempts} attempts`,
      source: "worker",
      metadata: { jobId: job.id, queue: job.queue, lastError: message }
    });
    return "dead";
  }
  const delay = backoffSeconds(job.attempts + 1);
  await exec.execute(sql`
    UPDATE jobs SET status = 'pending', last_error = ${message},
      run_after = now() + (${String(delay)} || ' seconds')::interval, updated_at = now()
    WHERE id = ${job.id}
  `);
  return "retry";
}

export async function replayDeadJob(exec: Executor, jobId: string): Promise<boolean> {
  const res = await exec.execute(sql`
    UPDATE jobs SET status = 'pending', attempts = 0, run_after = now(), updated_at = now()
    WHERE id = ${jobId} AND status = 'dead'
  `);
  return (res.rowCount ?? 0) > 0;
}

export async function pruneFinishedJobs(exec: Executor, olderThanDays: number): Promise<number> {
  const res = await exec.execute(sql`
    DELETE FROM jobs
    WHERE status IN ('completed', 'failed')
      AND updated_at < now() - (${String(olderThanDays)} || ' days')::interval
  `);
  return res.rowCount ?? 0;
}

export type RecentJobRow = {
  id: string;
  queue: string;
  status: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  run_after: string;
  created_at: string;
};

export async function listRecentJobs(exec: Executor, limit = 100): Promise<RecentJobRow[]> {
  const res = await exec.execute<RecentJobRow>(sql`
    SELECT id, queue, status, attempts, max_attempts, last_error, run_after, created_at
    FROM jobs ORDER BY created_at DESC LIMIT ${limit}
  `);
  return (res.rows ?? []) as RecentJobRow[];
}

export async function runPendingNow(
  exec: Executor,
  registry: HandlerRegistry,
  opts: { maxRounds?: number; batchSize?: number } = {}
): Promise<number> {
  const maxRounds = opts.maxRounds ?? 50;
  const batchSize = opts.batchSize ?? 20;
  let processed = 0;
  for (let round = 0; round < maxRounds; round++) {
    const batch = await claimBatch(exec, "inline-runner", batchSize);
    if (batch.length === 0) break;
    for (const job of batch) {
      const handler = registry.get(job.queue);
      try {
        if (!handler) throw new Error(`No handler registered for queue "${job.queue}"`);
        await handler((job.payload ?? {}) as JobPayload, exec);
        await completeJob(exec, job.id);
      } catch (e) {
        await failJob(exec, job, e);
      }
      processed++;
    }
  }
  return processed;
}
