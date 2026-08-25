import { sql } from "drizzle-orm";
import { Pool } from "pg";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

let pool: Pool | null = null;
let dbInstance: NodePgDatabase<typeof schema> | null = null;

export function getDb(): NodePgDatabase<typeof schema> & { $client: Pool } {
  if (!dbInstance) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is required");
    pool = new Pool({ connectionString: url, max: 10 });
    dbInstance = drizzle(pool, { schema });
  }
  return dbInstance as NodePgDatabase<typeof schema> & { $client: Pool };
}

export function getPool(): Pool {
  getDb();
  return pool!;
}

type PgTx = Parameters<Parameters<NodePgDatabase<typeof schema>["transaction"]>[0]>[0];

export type Executor = NodePgDatabase<typeof schema> | PgTx;

export async function withTransaction<T>(fn: (tx: PgTx) => Promise<T>): Promise<T> {
  return getDb().transaction(fn);
}

export async function checkDb(): Promise<boolean> {
  try {
    await getDb().execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}
