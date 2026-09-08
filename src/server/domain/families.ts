import { eq, sql } from "drizzle-orm";
import type { Executor } from "../db/client";
import { families, users, budgets } from "../db/schema";
import type { Actor } from "../auth/context";
import { isValidCurrency } from "@/lib/money";
import { errors } from "@/lib/errors";
import { recordAudit } from "../observability/audit";
import { convertMinor, getRate } from "./exchange-rates";

export async function createFamilyWithOwner(
  exec: Executor,
  input: { name: string; currency?: string },
  _ownerUserId: string
): Promise<string> {
  const name = input.name.trim();
  if (!name || name.length > 120) throw errors.validation("Family name must be 1–120 characters.");
  const currency = (input.currency ?? "USD").toUpperCase();
  if (!isValidCurrency(currency)) throw errors.validation("Unknown currency code.");

  const [family] = await exec
    .insert(families)
    .values({ name, currency })
    .returning({ id: families.id });
  if (!family) throw errors.conflict("Family could not be created.");
  return family.id;
}

export async function updateFamilySettings(
  exec: Executor,
  actor: Actor,
  patch: { name?: string; currency?: string; timezone?: string; locale?: string }
): Promise<void> {
  if (actor.familyRole !== "admin") throw errors.forbidden("Only family admins can change organization settings.");
  const updates: Partial<typeof families.$inferInsert> = { updatedAt: new Date() };
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name || name.length > 120) throw errors.validation("Family name must be 1–120 characters.");
    updates.name = name;
  }
  if (patch.currency !== undefined) {
    const newCurrency = patch.currency.toUpperCase();
    if (!isValidCurrency(newCurrency)) throw errors.validation("Unknown currency code.");

    const [current] = await exec
      .select({ currency: families.currency })
      .from(families)
      .where(eq(families.id, actor.familyId))
      .limit(1);

    if (current && current.currency !== newCurrency) {
      const oldCurrency = current.currency;
      // F12: Migrate existing budget limits using exchange rates
      const activeBudgets = await exec
        .select()
        .from(budgets)
        .where(eq(budgets.familyId, actor.familyId));

      if (activeBudgets.length > 0) {
        const today = new Date().toISOString().slice(0, 10);
        const rate = await getRate(exec, oldCurrency, newCurrency, today);
        if (rate) {
          for (const b of activeBudgets) {
            const converted = convertMinor(b.amountMinor, rate, oldCurrency, newCurrency);
            await exec
              .update(budgets)
              .set({ amountMinor: Math.max(1, converted), updatedAt: new Date() })
              .where(eq(budgets.id, b.id));
          }
        }
      }
    }
    updates.currency = newCurrency;
  }
  if (patch.timezone !== undefined) updates.timezone = validateTimezone(patch.timezone);
  if (patch.locale !== undefined) updates.locale = patch.locale;
  await exec.update(families).set(updates).where(eq(families.id, actor.familyId));
  await recordAudit(exec, {
    familyId: actor.familyId,
    actorUserId: actor.userId,
    action: "family.settings_updated",
    entityType: "family",
    entityId: actor.familyId,
    metadata: { fields: Object.keys(updates).filter((k) => k !== "updatedAt") }
  });
}

export function validateTimezone(tz: string): string {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    throw errors.validation("Unknown time zone.");
  }
}

export async function getFamilyById(exec: Executor, familyId: string) {
  const [row] = await exec.select().from(families).where(eq(families.id, familyId)).limit(1);
  return row ?? null;
}

export async function countAdmins(exec: Executor, familyId: string): Promise<number> {
  const [row] = await exec
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(sql`${users.familyId} = ${familyId}::uuid AND ${users.familyRole} = 'admin'`);
  return row?.count ?? 0;
}

export async function deleteFamily(exec: Executor, actor: Actor, confirmName: string): Promise<void> {
  if (actor.familyRole !== "admin") {
    throw errors.forbidden("Only the family admin can delete this family.");
  }
  const family = await getFamilyById(exec, actor.familyId);
  if (!family) throw errors.notFound("Family");
  if (family.name !== confirmName.trim()) {
    throw errors.validation("The confirmation text does not match the family name.");
  }
  await recordAudit(exec, {
    familyId: family.id,
    actorUserId: actor.userId,
    action: "family.deleted",
    entityType: "family",
    entityId: family.id,
    metadata: { name: family.name }
  });
  await exec.delete(families).where(eq(families.id, family.id));
}
