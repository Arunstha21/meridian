"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withTransaction } from "@/server/db/client";
import { assertActor } from "@/server/auth/context";
import { runAction, formValues, type ActionState } from "@/server/actions/runner";
import * as categoriesSvc from "@/server/domain/categories";
import * as tagsSvc from "@/server/domain/tags";

const categorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  color: z.string().max(20).optional(),
  parentId: z.string().optional(),
  op: z.enum(["create", "update", "delete"])
});

export async function manageCategoryAction(
  _prev: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  return runAction("category.manage", async () => {
    const actor = await assertActor();
    const input = categorySchema.safeParse(formValues(formData));
    if (!input.success)
      throw (await import("@/lib/errors")).errors.validation("Check the category fields.");
    const d = input.data;
    await withTransaction(async (tx) => {
      if (d.op === "create") {
        await categoriesSvc.createCategory(tx, actor, {
          name: d.name,
          color: d.color ?? null,
          parentId: d.parentId ? d.parentId : null
        });
      } else if (d.op === "update" && d.id) {
        await categoriesSvc.updateCategory(tx, actor, d.id, {
          ...(d.name !== undefined ? { name: d.name } : {}),
          ...(d.color !== undefined ? { color: d.color } : {}),
          ...(d.parentId !== undefined ? { parentId: d.parentId ? d.parentId : null } : {})
        });
      } else if (d.op === "delete" && d.id) {
        await categoriesSvc.deleteCategory(tx, actor, d.id);
      }
    });
    revalidatePath("/settings/categories");
    revalidatePath("/transactions");
    return undefined;
  });
}

const tagSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(60),
  color: z.string().max(20).optional(),
  op: z.enum(["create", "update", "delete"])
});

export async function deleteCategoryAction(formData: FormData): Promise<ActionState> {
  "use server";
  return runAction("category.delete", async () => {
    const actor = await assertActor();
    const id = String(formData.get("id") ?? "");
    if (!id) return;
    await withTransaction((tx) => categoriesSvc.deleteCategory(tx, actor, id));
    revalidatePath("/settings/categories");
    revalidatePath("/transactions");
  });
}

export async function manageTagAction(
  _prev: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  return runAction("tag.manage", async () => {
    const actor = await assertActor();
    const input = tagSchema.safeParse(formValues(formData));
    if (!input.success)
      throw (await import("@/lib/errors")).errors.validation("Check the tag fields.");
    const d = input.data;
    await withTransaction(async (tx) => {
      if (d.op === "create") {
        await tagsSvc.createTag(tx, actor, { name: d.name, color: d.color ?? null });
      } else if (d.op === "update" && d.id) {
        await tagsSvc.updateTag(tx, actor, d.id, {
          ...(d.name !== undefined ? { name: d.name } : {}),
          ...(d.color !== undefined ? { color: d.color } : {})
        });
      } else if (d.op === "delete" && d.id) {
        await tagsSvc.deleteTag(tx, actor, d.id);
      }
    });
    revalidatePath("/settings/tags");
    revalidatePath("/transactions");
    return undefined;
  });
}

export async function deleteTagAction(formData: FormData): Promise<ActionState> {
  "use server";
  return runAction("tag.delete", async () => {
    const actor = await assertActor();
    const id = String(formData.get("id") ?? "");
    if (!id) return;
    await withTransaction((tx) => tagsSvc.deleteTag(tx, actor, id));
    revalidatePath("/settings/tags");
    revalidatePath("/transactions");
  });
}
