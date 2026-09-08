import "dotenv/config";
import { closeDb, getDb } from "@/server/db/client";
import {
  recoverStaleJobs,
  claimBatch,
  completeJob,
  failJob,
  runDueCrons
} from "@/server/queue/worker-loop";
import { createJobRegistry, registerWorkerBootstraps } from "@/server/queue/jobs";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";

const workerName = env.WORKER_NAME || `worker-${process.pid}`;
let running = true;
let wake: (() => void) | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(() => resolve(), ms);
    wake = () => {
      clearTimeout(timer);
      resolve();
    };
  }).finally(() => {
    wake = null;
  });
}

function stop(): void {
  running = false;
  wake?.();
}

async function tick(): Promise<void> {
  const db = getDb();
  const registry = await createJobRegistry();
  await recoverStaleJobs(db);
  if (!running) return;
  await runDueCrons(db);
  for (let i = 0; i < 25; i++) {
    if (!running) return;
    const batch = await claimBatch(db, workerName, 10);
    if (batch.length === 0) break;
    for (const job of batch) {
      if (!running) return;
      const handler = registry.get(job.queue);
      try {
        if (!handler) throw new Error(`No handler for queue "${job.queue}"`);
        const started = Date.now();
        await handler(job.payload as Record<string, unknown>, db);
        await completeJob(db, job.id);
        log.info({ queue: job.queue, jobId: job.id, ms: Date.now() - started }, "job.completed");
      } catch (e) {
        const outcome = await failJob(db, job, e);
        log.warn({ queue: job.queue, jobId: job.id, outcome }, "job.failed");
      }
    }
  }
}

async function main() {
  log.info({ workerName, pollMs: env.WORKER_POLL_MS }, "worker.started");
  await registerWorkerBootstraps(getDb());
  while (running) {
    try {
      await tick();
    } catch (e) {
      log.error(
        { err: e instanceof Error ? { name: e.name, message: e.message } : e },
        "worker.tick_failed"
      );
    }
    if (!running) break;
    await sleep(env.WORKER_POLL_MS);
  }
  log.info({}, "worker.stopped");
  await closeDb();
}

process.on("SIGTERM", stop);
process.on("SIGINT", stop);

void main();
