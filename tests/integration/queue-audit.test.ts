import { describe, it, expect, beforeAll } from "vitest";
import { sql } from "drizzle-orm";
import { db, makeUser, makeAccount, addTxn, truncateAll, actorOf } from "../helpers";
import { enqueue, runPendingNow, claimBatch, failJob, pruneFinishedJobs } from "@/server/queue";
import { createJobRegistry, registerWorkerBootstraps } from "@/server/queue/jobs";
import { ensureSchedules, runDueCrons } from "@/server/queue/worker-loop";

beforeAll(async () => {
  await truncateAll();
});

describe("durable queue", () => {
  it("delivers email through the registry handler", async () => {
    await enqueue(db(), "email", { to: "x@test.local", subject: "Hi", text: "Body" });
    const processed = await runPendingNow(db(), await createJobRegistry());
    expect(processed).toBeGreaterThanOrEqual(1);
  });

  it("collapses duplicate dedupe keys while pending", async () => {
    const a = await enqueue(db(), "email", {}, { dedupeKey: "same-key" });
    const b = await enqueue(db(), "email", {}, { dedupeKey: "same-key" });
    expect(a).toBeTruthy();
    expect(b).toBeNull();
  });

  it("retries with backoff then dead-letters and records diagnostics", async () => {
    const failing = new Map<string, () => Promise<void>>();
    failing.set("boom", async () => {
      throw new Error("kaboom");
    });
    const registry = new Map<string, (p: Record<string, unknown>, e: never) => Promise<void>>();
    void registry;

    const jobId = await enqueue(db(), "boom", {}, { maxAttempts: 2 });
    expect(jobId).toBeTruthy();

    for (let round = 0; round < 10; round++) {
      const batch = await claimBatch(db(), "test", 5);
      for (const job of batch) {
        if (job.queue === "boom") {
          await failJob(db(), job, new Error("kaboom"));
        }
      }
      await db().execute(
        sql`UPDATE jobs SET run_after = now() - interval '1 minute' WHERE id = ${jobId}::uuid AND status = 'pending'`
      );
      const status = await db().execute<{ status: string }>(
        sql`SELECT status FROM jobs WHERE id = ${jobId}::uuid`
      );
      if (status.rows![0]!.status === "dead") break;
    }

    const finalStatus = await db().execute<{ status: string }>(
      sql`SELECT status FROM jobs WHERE id = ${jobId}::uuid`
    );
    expect(finalStatus.rows![0]!.status).toBe("dead");

    const diag = await db().execute<{ message: string }>(sql`
      SELECT message FROM debug_log_entries WHERE category='jobs' ORDER BY created_at DESC LIMIT 1
    `);
    expect((diag.rows ?? [])[0]?.message).toContain("dead-letter");
  });

  it("cron schedules enqueue work exactly once per scheduled slot", async () => {
    await ensureSchedules(db(), [
      { key: "test-nightly", queue: "maintenance:cleanup", cron: "* * * * *", payload: {} }
    ]);

    await db().execute(sql`
      UPDATE cron_schedules SET next_run_at = now() - interval '1 minute' WHERE key='test-nightly'
    `);
    const fired1 = await runDueCrons(db());
    expect(fired1).toBe(1);

    const fired2 = await runDueCrons(db());
    expect(fired2).toBe(0);

    const jobs = await db().execute<{ c: string }>(sql`
      SELECT count(*)::text AS c FROM jobs WHERE queue='maintenance:cleanup'
    `);
    expect(Number(jobs.rows![0]!.c)).toBe(1);
  });

  it("prunes old completed and dead jobs but keeps recent dead letters", async () => {
    const oldCompleted = await enqueue(db(), "email", {
      to: "old@test.local",
      subject: "x",
      text: "y"
    });
    const oldDead = await enqueue(db(), "email", {
      to: "dead@test.local",
      subject: "x",
      text: "y"
    });
    const recentDead = await enqueue(db(), "email", {
      to: "new@test.local",
      subject: "x",
      text: "y"
    });
    await db().execute(sql`
      UPDATE jobs SET status = 'completed', updated_at = now() - interval '20 days' WHERE id = ${oldCompleted}::uuid
    `);
    await db().execute(sql`
      UPDATE jobs SET status = 'dead', updated_at = now() - interval '20 days' WHERE id = ${oldDead}::uuid
    `);
    await db().execute(sql`
      UPDATE jobs SET status = 'dead', updated_at = now() WHERE id = ${recentDead}::uuid
    `);
    const removed = await pruneFinishedJobs(db(), 14);
    expect(removed).toBeGreaterThanOrEqual(2);
    const leftover = await db().execute<{ id: string }>(sql`
      SELECT id::text AS id FROM jobs WHERE id IN (${oldCompleted}::uuid, ${oldDead}::uuid, ${recentDead}::uuid)
    `);
    expect(leftover.rows?.map((r) => r.id)).toEqual([recentDead]);
  });

  it("worker bootstrap registers maintenance crons", async () => {
    await registerWorkerBootstraps(db());
    const rows = await db().execute<{ c: string }>(
      sql`SELECT count(*)::text AS c FROM cron_schedules`
    );
    expect(Number(rows.rows![0]!.c)).toBeGreaterThanOrEqual(2);
  });
});

describe("audit trail", () => {
  it("records entries and transfers on sensitive mutations", async () => {
    const user = await makeUser();
    const account = await makeAccount(user);
    await addTxn(user, account, { amountLedgerMinor: 500 });

    const events = await db().execute<{ action: string }>(sql`
      SELECT action FROM audit_events WHERE family_id = ${user.familyId}::uuid ORDER BY created_at
    `);
    const actions = (events.rows ?? []).map((r) => r.action);
    expect(actions).toContain("user.registered");
    expect(actions).toContain("account.created");
    expect(actions).toContain("entry.created");
  });
});

void actorOf;
