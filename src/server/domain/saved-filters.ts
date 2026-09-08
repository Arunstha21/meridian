import { and, asc, eq, sql } from "drizzle-orm";
import type { Executor } from "../db/client";
import { savedFilters } from "../db/schema";
import { errors } from "@/lib/errors";

const MAX_NAME_LENGTH = 80;
const ALLOWED_KEYS = new Set(["q", "account", "category", "tag", "kind", "from", "to"]);

export type SavedFilterRow = typeof savedFilters.$inferSelect;

/** Keeps only recognized query keys so a saved filter can never smuggle in odd params. */
export function sanitizeParams(params: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (ALLOWED_KEYS.has(key) && value !== undefined && value !== "") {
      out[key] = value.slice(0, 200);
    }
  }
  return out;
}

export async function createSavedFilter(
  exec: Executor,
  userId: string,
  name: string,
  params: Record<string, string>
): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) throw errors.validation("A name is required.");
  if (trimmed.length > MAX_NAME_LENGTH) throw errors.validation("Name is too long.");
  if (Object.keys(params).length === 0)
    throw errors.validation("Nothing to save — set some filters first.");

  const [existing] = await exec
    .select({ id: savedFilters.id })
    .from(savedFilters)
    .where(
      and(eq(savedFilters.userId, userId), sql`lower(${savedFilters.name}) = lower(${trimmed})`)
    )
    .limit(1);

  if (existing) {
    await exec.update(savedFilters).set({ params }).where(eq(savedFilters.id, existing.id));
    return existing.id;
  }

  try {
    const [row] = await exec
      .insert(savedFilters)
      .values({ userId, name: trimmed, params })
      .returning({ id: savedFilters.id });
    const id = row?.id;
    if (!id) throw errors.conflict("Failed to save filter.");
    return id;
  } catch (e) {
    // Two concurrent saves with the same name can both miss the SELECT above;
    // the loser lands here and falls back to the update path.
    if (e instanceof Error && (e as { code?: string }).code === "23505") {
      const [existing] = await exec
        .select({ id: savedFilters.id })
        .from(savedFilters)
        .where(
          and(eq(savedFilters.userId, userId), sql`lower(${savedFilters.name}) = lower(${trimmed})`)
        )
        .limit(1);
      if (existing) {
        await exec.update(savedFilters).set({ params }).where(eq(savedFilters.id, existing.id));
        return existing.id;
      }
    }
    throw e;
  }
}

export async function listSavedFilters(exec: Executor, userId: string) {
  return exec
    .select({ id: savedFilters.id, name: savedFilters.name, params: savedFilters.params })
    .from(savedFilters)
    .where(eq(savedFilters.userId, userId))
    .orderBy(asc(savedFilters.name));
}

export async function deleteSavedFilter(exec: Executor, userId: string, id: string): Promise<void> {
  const removed = await exec
    .delete(savedFilters)
    .where(and(eq(savedFilters.id, id), eq(savedFilters.userId, userId)))
    .returning({ id: savedFilters.id });
  if (removed.length === 0) throw errors.notFound("Saved filter");
}
