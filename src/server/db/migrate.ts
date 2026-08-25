import { sql } from "drizzle-orm";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Executor, getDb } from "./client";
import { log } from "@/lib/logger";

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

export async function appliedMigrations(exec: Executor): Promise<string[]> {
  await exec.execute(
    sql`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`
  );
  const res = await exec.execute<{ name: string }>(sql`SELECT name FROM schema_migrations ORDER BY name`);
  return (res.rows ?? []).map((r) => r.name);
}

export async function listLocalMigrations(): Promise<string[]> {
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
  const db = getDb();
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
}

export async function migrateDownStep(): Promise<string | null> {
  const db = getDb();
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
}
