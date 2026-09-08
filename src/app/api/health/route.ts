import { NextResponse } from "next/server";
import { checkDb, getDb } from "@/server/db/client";
import { migrateStatusReport } from "@/server/db/migrate";
import { getQueueStats } from "@/server/queue";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbOk = await checkDb();
  if (!dbOk) {
    return NextResponse.json({ status: "error", db: false, migrations: "unknown" }, { status: 503 });
  }

  try {
    const report = await migrateStatusReport();
    const db = getDb();
    const queueStats = await getQueueStats(db);
    const mailOk = env.MAIL_TRANSPORT !== "smtp" || !!env.SMTP_URL;

    const isDegraded = report.pending.length > 0 || !mailOk || queueStats.dead > 0;
    const httpStatus = report.pending.length > 0 ? 503 : 200;

    return NextResponse.json(
      {
        status: isDegraded ? "degraded" : "ok",
        db: true,
        migrations: report.pending.length > 0 ? `pending:${report.pending.length}` : "current",
        queue: queueStats,
        mail: {
          transport: env.MAIL_TRANSPORT,
          ready: mailOk
        }
      },
      { status: httpStatus }
    );
  } catch {
    return NextResponse.json({ status: "error", db: true, migrations: "error" }, { status: 503 });
  }
}
