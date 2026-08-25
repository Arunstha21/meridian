import "dotenv/config";
import { getDb } from "@/server/db/client";
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

async function tick(): Promise<void> {
  const db = getDb();
  const registry = await createJobRegistry();
  await recoverStaleJobs(db);
  await runDueCrons(db);
  for (let i = 0; i < 25; i++) {
    if (!running) return;
    const batch = await claimBatch(db, workerName, 10);
    if (batch.length === 0) break;
    for (const job of batch) {
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
      log.error({ err: e instanceof Error ? { name: e.name, message: e.message } : e }, "worker.tick_failed");
    }
    await new Promise((r) => setTimeout(r, env.WORKER_POLL_MS));
  }
  log.info({}, "worker.stopped");
}

process.on("SIGTERM", () => {
  running = false;
});
process.on("SIGINT", () => {
  running = false;
});

void main();
