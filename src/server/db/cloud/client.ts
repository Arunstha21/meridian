import { AsyncLocalStorage } from "node:async_hooks";
import { type SQLWrapper } from "drizzle-orm";
import { SQLiteAsyncDialect } from "drizzle-orm/sqlite-core";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";

export interface CloudSqlCursor {
  toArray(): Record<string, unknown>[];
  raw(): { toArray(): unknown[][] };
  rowsWritten: number;
}

/** Structural subset of SQLite-backed DurableObjectStorage. */
export interface CloudStorage {
  sql: { exec(query: string, ...bindings: (string | number | null)[]): CloudSqlCursor };
  transaction<T>(callback: () => Promise<T>): Promise<T>;
}

function binding(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
      throw new RangeError("SQLite binding exceeds the safe integer range");
    }
    return value;
  }
  throw new TypeError("Unsupported SQLite binding");
}

/**
 * All access, including reads, shares a mutex. A transaction holds it across
 * awaits so a second request cannot observe or commit its partial writes.
 * Durable Object storage owns the actual commit and rollback; no SQL BEGIN,
 * COMMIT, or dropped transaction wrappers are used.
 */
export function createCloudDatabase(storage: CloudStorage) {
  const inTransaction = new AsyncLocalStorage<boolean>();
  let tail: Promise<unknown> = Promise.resolve();
  function exclusive<T>(operation: () => Promise<T>): Promise<T> {
    if (inTransaction.getStore()) return operation();
    const result = tail.then(operation);
    tail = result.catch(() => undefined);
    return result;
  }

  const orm = drizzle(
    async (query, params, method) =>
      exclusive(async () => {
        // Cursors must be consumed before yielding to another event.
        const rows = storage.sql
          .exec(query, ...params.map(binding))
          .raw()
          .toArray();
        return { rows: method === "get" ? (rows[0] ?? []) : rows };
      }),
    { schema }
  );
  const dialect = new SQLiteAsyncDialect();

  async function execute<T extends Record<string, unknown> = Record<string, unknown>>(
    query: SQLWrapper
  ): Promise<{ rows: T[]; rowCount: number }> {
    return exclusive(async () => {
      const compiled = dialect.sqlToQuery(query.getSQL());
      const cursor = storage.sql.exec(compiled.sql, ...compiled.params.map(binding));
      const rows = cursor.toArray() as T[];
      const changes = storage.sql.exec("SELECT changes() AS count").toArray()[0]?.count;
      return { rows, rowCount: rows.length || Number(changes ?? 0) };
    });
  }

  type Database = Omit<typeof orm, "transaction"> & {
    execute: typeof execute;
    transaction<T>(callback: (tx: Database) => Promise<T>): Promise<T>;
  };
  const db: Database = Object.assign(orm, {
    execute,
    transaction<T>(callback: (tx: Database) => Promise<T>): Promise<T> {
      return exclusive(() =>
        inTransaction.run(true, () => storage.transaction(() => callback(db)))
      );
    }
  });
  return db;
}

export type CloudDatabase = ReturnType<typeof createCloudDatabase>;
