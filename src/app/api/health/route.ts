import { NextResponse } from "next/server";
import { checkDb } from "@/server/db/client";
import { migrateStatusReport } from "@/server/db/migrate";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbOk = await checkDb();
  if (!dbOk) {
    return NextResponse.json({ status: "error", db: false, migrations: "unknown" }, { status: 503 });
  }

  try {
    const report = await migrateStatusReport();
    if (report.pending.length > 0) {
      return NextResponse.json(
        { status: "degraded", db: true, migrations: `pending:${report.pending.length}` },
        { status: 503 }
      );
    }
    return NextResponse.json({ status: "ok", db: true, migrations: "current" }, { status: 200 });
  } catch {
    return NextResponse.json({ status: "error", db: true, migrations: "error" }, { status: 503 });
  }
}
