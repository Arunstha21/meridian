import { and, asc, eq, sql } from "drizzle-orm";
import type { Executor } from "../db/client";
import { accounts, categories, entries, transactions } from "../db/schema";
import type { Actor } from "../auth/context";
import { errors } from "@/lib/errors";

export type CategoryNode = {
  id: string;
  name: string;
  color: string | null;
  parentId: string | null;
};

export async function createCategory(
  exec: Executor,
  actor: Actor,
  input: { name: string; color?: string | null; parentId?: string | null }
): Promise<{ categoryId: string }> {
  const name = normalizeName(input.name);
  let parentId: string | null = null;
  if (input.parentId) {
    const [parent] = await exec
      .select()
      .from(categories)
      .where(and(eq(categories.id, input.parentId), eq(categories.familyId, actor.familyId)))
      .limit(1);
    if (!parent) throw errors.validation("Parent category not found.");
    if (parent.parentId) throw errors.validation("Categories can only nest one level deep.");
    parentId = parent.id;
  }
  try {
    const [row] = await exec
      .insert(categories)
      .values({ familyId: actor.familyId, name, color: input.color ?? null, parentId })
      .returning({ id: categories.id });
    const categoryId = row?.id;
    if (!categoryId) throw errors.conflict("Failed to create category.");
    return { categoryId };
  } catch (e) {
    if (isUniqueViolation(e)) throw errors.conflict(`Category "${name}" already exists.`);
    throw e;
  }
}

export async function updateCategory(
  exec: Executor,
  actor: Actor,
  categoryId: string,
  patch: { name?: string; color?: string | null; parentId?: string | null }
): Promise<void> {
  const existing = await requireFamilyCategory(exec, actor.familyId, categoryId);
  const updates: Partial<typeof categories.$inferInsert> = {};
  if (patch.name !== undefined) updates.name = normalizeName(patch.name);
  if (patch.color !== undefined) updates.color = patch.color;
  if (patch.parentId !== undefined) {
    if (patch.parentId === null) {
      updates.parentId = null;
    } else {
      const [parent] = await exec
        .select()
        .from(categories)
        .where(and(eq(categories.id, patch.parentId), eq(categories.familyId, actor.familyId)))
        .limit(1);
      if (!parent || parent.id === categoryId || parent.parentId) {
        throw errors.validation("Invalid parent category.");
      }
      updates.parentId = parent.id;
    }
  }
  try {
    await exec.update(categories).set(updates).where(eq(categories.id, categoryId));
  } catch (e) {
    if (isUniqueViolation(e)) throw errors.conflict(`Category "${updates.name}" already exists.`);
    throw e;
  }
  void existing;
}

export async function deleteCategory(
  exec: Executor,
  actor: Actor,
  categoryId: string
): Promise<void> {
  await requireFamilyCategory(exec, actor.familyId, categoryId);
  const [usage] = await exec
    .select({ count: sql<number>`count(*)::int` })
    .from(transactions)
    .innerJoin(entries, eq(entries.id, transactions.entryId))
    .innerJoin(accounts, eq(accounts.id, entries.accountId))
    .where(and(eq(transactions.categoryId, categoryId), eq(accounts.familyId, actor.familyId)));
  if ((usage?.count ?? 0) > 0) {
    throw errors.conflict(
      `This category is used by ${usage!.count} transaction(s). Reassign them first.`
    );
  }
  await exec.delete(categories).where(eq(categories.id, categoryId));
}

export async function listCategories(exec: Executor, familyId: string): Promise<CategoryNode[]> {
  const rows = await exec
    .select({
      id: categories.id,
      name: categories.name,
      color: categories.color,
      parentId: categories.parentId
    })
    .from(categories)
    .where(eq(categories.familyId, familyId))
    .orderBy(asc(categories.name));
  return rows;
}

async function requireFamilyCategory(exec: Executor, familyId: string, categoryId: string) {
  const [row] = await exec
    .select()
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.familyId, familyId)))
    .limit(1);
  if (!row) throw errors.notFound("Category");
  return row;
}

function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 80)
    throw errors.validation("Category names must be 1–80 characters.");
  return trimmed;
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "23505";
}
