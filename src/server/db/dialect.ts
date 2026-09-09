import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

export const usesCloudStorage =
  (process.env.DATABASE_BACKEND ?? (process.env.DATABASE_URL ? "postgres" : "cloud-sqlite")) ===
  "cloud-sqlite";
export const databaseNow = usesCloudStorage
  ? sql`strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
  : sql`now()`;
export const rowLock = usesCloudStorage ? sql`` : sql`FOR UPDATE SKIP LOCKED`;

export function dateDistance(left: SQL, right: string): SQL {
  return usesCloudStorage
    ? sql`abs(julianday(${left}) - julianday(${right}))`
    : sql`abs(${left} - CAST(${right} AS date))`;
}

export function caseInsensitiveLike(column: SQLWrapper, pattern: string): SQL {
  return sql`lower(${column}) LIKE lower(${pattern})`;
}

export function mergeJson(column: SQL, patch: Record<string, unknown>): SQL {
  return usesCloudStorage
    ? sql`json_patch(${column}, ${JSON.stringify(patch)})`
    : sql`${column} || CAST(${JSON.stringify(patch)} AS jsonb)`;
}
