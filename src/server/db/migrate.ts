import { sql } from "drizzle-orm";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Executor, getDb } from "./client";
import { log } from "@/lib/logger";
import { usesCloudStorage } from "./dialect";
import { CLOUD_MIGRATION_NAMES } from "./cloud/versions";

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");
const MIGRATION_LOCK_ID = 849201948;

export async function appliedMigrations(exec: Executor): Promise<string[]> {
  if (usesCloudStorage) {
    const result = await exec.execute<{ name: string }>(
      sql`SELECT name FROM cloud_schema_migrations ORDER BY name`
    );
    return result.rows.map((row) => row.name);
  }
  await exec.execute(
    sql`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`
  );
  const res = await exec.execute<{ name: string }>(
    sql`SELECT name FROM schema_migrations ORDER BY name`
  );
  return (res.rows ?? []).map((r) => r.name);
}

export async function listLocalMigrations(): Promise<string[]> {
  if (usesCloudStorage) return CLOUD_MIGRATION_NAMES.map((name) => `${name}.up.sql`);
  return (await readdir(MIGRATIONS_DIR)).sort().filter((f) => f.endsWith(".up.sql"));
}

export async function migrateStatusReport(): Promise<{ applied: string[]; pending: string[] }> {
  const db = getDb();
  const local = await listLocalMigrations();
  const applied = await appliedMigrations(db);
  return {
    applied,
    pending: local.filter((m) => !applied.includes(m.replace(/\.up\.sql$/, "")))
  };
}

export async function migrateUp(): Promise<string[]> {
  if (usesCloudStorage) throw new Error("Cloud migrations run inside Durable Object storage");
  const db = getDb();
  await db.execute(sql`SELECT pg_advisory_lock(${MIGRATION_LOCK_ID})`);
  try {
    const local = await listLocalMigrations();
    const applied = await appliedMigrations(db);
    const ran: string[] = [];
    for (const file of local) {
      const name = file.replace(/\.up\.sql$/, "");
      if (applied.includes(name)) continue;
      const source = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      await db.transaction(async (tx) => {
        await tx.execute(sql.raw(source));
        await tx.execute(sql`INSERT INTO schema_migrations (name) VALUES (${name})`);
      });
      ran.push(name);
      log.info({ migration: name }, "migration.applied");
    }
    return ran;
  } finally {
    await db.execute(sql`SELECT pg_advisory_unlock(${MIGRATION_LOCK_ID})`);
  }
}

export async function migrateDownStep(): Promise<string | null> {
  if (usesCloudStorage) throw new Error("Use Cloudflare point-in-time recovery for cloud storage");
  const db = getDb();
  await db.execute(sql`SELECT pg_advisory_lock(${MIGRATION_LOCK_ID})`);
  try {
    const applied = await appliedMigrations(db);
    const last = applied[applied.length - 1];
    if (!last) return null;
    let source: string;
    try {
      source = await readFile(path.join(MIGRATIONS_DIR, `${last}.down.sql`), "utf8");
    } catch {
      throw new Error(`No down migration found for ${last}`);
    }
    const keepTable = last === "0001_init";
    await db.transaction(async (tx) => {
      await tx.execute(sql.raw(source));
      if (!keepTable) {
        await tx.execute(sql`DELETE FROM schema_migrations WHERE name = ${last}`);
      }
    });
    log.info({ migration: last }, "migration.reverted");
    return last;
  } finally {
    await db.execute(sql`SELECT pg_advisory_unlock(${MIGRATION_LOCK_ID})`);
  }
}
