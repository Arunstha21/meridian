import { NextResponse } from "next/server";
import { checkDb, getDb } from "@/server/db/client";
import { migrateStatusReport } from "@/server/db/migrate";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbOk = await checkDb();
  if (!dbOk) {
    return NextResponse.json({ status: "error", db: false }, { status: 503 });
  }
  let migrations = "unknown";
  try {
    const report = await migrateStatusReport();
    migrations = report.pending.length === 0 ? "current" : `pending:${report.pending.length}`;
    await getDb().execute(sql`SELECT 1`);
  } catch {
    migrations = "error";
  }
  return NextResponse.json(
    { status: migrations === "pending:0" || migrations === "current" ? "ok" : "degraded", db: true, migrations },
    { status: 200 }
  );
}
