import { and, eq } from "drizzle-orm";
import type { Executor } from "../db/client";
import { tags, transactionTags } from "../db/schema";
import type { Actor } from "../auth/context";
import { errors } from "@/lib/errors";

export type TagRow = typeof tags.$inferSelect;

export async function createTag(
  exec: Executor,
  actor: Actor,
  input: { name: string; color?: string | null }
): Promise<{ tagId: string }> {
  const name = normalizeName(input.name);
  try {
    const [row] = await exec
      .insert(tags)
      .values({ familyId: actor.familyId, name, color: input.color ?? null })
      .returning({ id: tags.id });
    const tagId = row?.id;
    if (!tagId) throw errors.conflict("Failed to create tag.");
    return { tagId };
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw errors.conflict(`Tag "${name}" already exists.`);
    throw e;
  }
}

export async function updateTag(
  exec: Executor,
  actor: Actor,
  tagId: string,
  patch: { name?: string; color?: string | null }
): Promise<void> {
  await requireFamilyTag(exec, actor.familyId, tagId);
  const updates: Partial<typeof tags.$inferInsert> = {};
  if (patch.name !== undefined) updates.name = normalizeName(patch.name);
  if (patch.color !== undefined) updates.color = patch.color;
  try {
    await exec.update(tags).set(updates).where(eq(tags.id, tagId));
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw errors.conflict(`Tag "${updates.name}" already exists.`);
    throw e;
  }
}

export async function deleteTag(exec: Executor, actor: Actor, tagId: string): Promise<void> {
  await requireFamilyTag(exec, actor.familyId, tagId);
  await exec.delete(transactionTags).where(eq(transactionTags.tagId, tagId));
  await exec.delete(tags).where(eq(tags.id, tagId));
}

export async function listTags(exec: Executor, familyId: string): Promise<TagRow[]> {
  return exec.select().from(tags).where(eq(tags.familyId, familyId)).orderBy(tags.name);
}

async function requireFamilyTag(exec: Executor, familyId: string, tagId: string) {
  const [row] = await exec
    .select()
    .from(tags)
    .where(and(eq(tags.id, tagId), eq(tags.familyId, familyId)))
    .limit(1);
  if (!row) throw errors.notFound("Tag");
  return row;
}

function normalizeName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 60) throw errors.validation("Tag names must be 1–60 characters.");
  return trimmed;
}
