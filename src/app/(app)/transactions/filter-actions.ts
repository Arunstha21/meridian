"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireVerifiedActor } from "@/server/auth/context";
import { getDb } from "@/server/db/client";
import { createSavedFilter, deleteSavedFilter, sanitizeParams } from "@/server/domain/saved-filters";
import { runAction, type ActionState } from "@/server/actions/runner";

const saveSchema = z.object({
  name: z.string().min(1).max(80),
  params: z.record(z.string(), z.string())
});

export async function saveFilterAction(_prev: ActionState | undefined, formData: FormData): Promise<ActionState> {
  return runAction("filters.save", async () => {
    const input = saveSchema.parse({
      name: formData.get("name") ?? "",
      params: JSON.parse(String(formData.get("params") ?? "{}"))
    });
    const actor = await requireVerifiedActor();
    await createSavedFilter(getDb(), actor.userId, input.name, sanitizeParams(input.params));
    revalidatePath("/transactions");
    return undefined;
  });
}

export async function deleteFilterAction(formData: FormData): Promise<void> {
  await runAction("filters.delete", async () => {
    const actor = await requireVerifiedActor();
    await deleteSavedFilter(getDb(), actor.userId, String(formData.get("id") ?? ""));
    revalidatePath("/transactions");
  });
}
