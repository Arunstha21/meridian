import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getDb } from "@/server/db/client";
import { loadActor } from "@/server/auth/context";
import { buildFamilyExport } from "@/server/domain/exports";

export const dynamic = "force-dynamic";

export async function GET() {
  const h = await headers();
  const accept = h.get("accept") ?? "";
  void accept;
  const actor = await loadActor();
  if (!actor) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = getDb();
  const data = await buildFamilyExport(db, actor);
  const filename = `meridian-export-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store"
    }
  });
}
