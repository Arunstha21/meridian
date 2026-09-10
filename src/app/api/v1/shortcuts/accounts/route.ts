import { NextResponse } from "next/server";
import { authenticateApiRequest } from "@/server/auth/api-auth";
import { getDb } from "@/server/db/client";
import { accounts, categories } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const actor = await authenticateApiRequest(req);
    const db = getDb();

    const userAccounts = await db
      .select({
        id: accounts.id,
        name: accounts.name,
        institution: accounts.institution,
        type: accounts.type,
        currency: accounts.currency,
        status: accounts.status
      })
      .from(accounts)
      .where(and(eq(accounts.familyId, actor.familyId), eq(accounts.status, "active")));

    const userCategories = await db
      .select({
        id: categories.id,
        name: categories.name,
        color: categories.color
      })
      .from(categories)
      .where(eq(categories.familyId, actor.familyId));

    return NextResponse.json({
      ok: true,
      accounts: userAccounts,
      categories: userCategories
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error.";
    const status = msg.includes("unauthorized") || msg.includes("API key") ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
