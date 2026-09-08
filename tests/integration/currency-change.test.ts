import { describe, it, expect, beforeAll } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, makeUser, actorOf, daysAgo, truncateAll } from "../helpers";
import * as familiesSvc from "@/server/domain/families";
import * as budgetsSvc from "@/server/domain/budgets";
import * as exchangeRatesSvc from "@/server/domain/exchange-rates";
import { budgets, families } from "@/server/db/schema";

beforeAll(async () => {
  await truncateAll();
});

async function familyCurrency(familyId: string): Promise<string | undefined> {
  const [row] = await db().select().from(families).where(eq(families.id, familyId));
  return row?.currency;
}

async function activeBudget(familyId: string) {
  const [row] = await db()
    .select()
    .from(budgets)
    .where(and(eq(budgets.familyId, familyId), eq(budgets.active, true)));
  return row ?? null;
}

describe("F13: currency change integrity", () => {
  it("rejects the change when active budgets exist without an exchange rate", async () => {
    const admin = await makeUser({ currency: "USD" });
    await budgetsSvc.setBudget(db(), actorOf(admin), {
      categoryId: null,
      amountLedgerMinor: 100000
    });

    await expect(
      familiesSvc.updateFamilySettings(db(), actorOf(admin), { currency: "EUR" })
    ).rejects.toMatchObject({ code: "validation.failed" });

    // Nothing changed: family currency and budget keep their old meaning.
    expect(await familyCurrency(admin.familyId)).toBe("USD");
    expect((await activeBudget(admin.familyId))?.amountMinor).toBe(100000);
  });

  it("converts active budgets and switches the currency when a rate exists", async () => {
    const admin = await makeUser({ currency: "USD" });
    await budgetsSvc.setBudget(db(), actorOf(admin), {
      categoryId: null,
      amountLedgerMinor: 100000
    });
    await exchangeRatesSvc.upsertRate(db(), {
      base: "USD",
      quote: "EUR",
      rate: "0.9",
      quotedOn: daysAgo(1)
    });

    await familiesSvc.updateFamilySettings(db(), actorOf(admin), { currency: "EUR" });

    expect(await familyCurrency(admin.familyId)).toBe("EUR");
    expect((await activeBudget(admin.familyId))?.amountMinor).toBe(90000);
  });

  it("changes currency freely when the family has no active budgets", async () => {
    const admin = await makeUser({ currency: "USD" });
    await familiesSvc.updateFamilySettings(db(), actorOf(admin), { currency: "JPY" });
    expect(await familyCurrency(admin.familyId)).toBe("JPY");
  });

  it("leaves superseded (inactive) budget history untouched", async () => {
    const admin = await makeUser({ currency: "USD" });
    await budgetsSvc.setBudget(db(), actorOf(admin), {
      categoryId: null,
      amountLedgerMinor: 100000
    });
    await budgetsSvc.setBudget(db(), actorOf(admin), {
      categoryId: null,
      amountLedgerMinor: 200000
    });
    await exchangeRatesSvc.upsertRate(db(), {
      base: "USD",
      quote: "EUR",
      rate: "0.9",
      quotedOn: daysAgo(1)
    });

    await familiesSvc.updateFamilySettings(db(), actorOf(admin), { currency: "EUR" });

    const rows = await db().select().from(budgets).where(eq(budgets.familyId, admin.familyId));
    const active = rows.filter((r) => r.active);
    const inactive = rows.filter((r) => !r.active);
    expect(active).toHaveLength(1);
    expect(active[0]?.amountMinor).toBe(180000);
    expect(inactive).toHaveLength(1);
    expect(inactive[0]?.amountMinor).toBe(100000);
  });
});
