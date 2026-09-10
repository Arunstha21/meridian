"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertActor } from "@/server/auth/context";
import { getDb } from "@/server/db/client";
import { runAction, formValues, type ActionState } from "@/server/actions/runner";
import * as apiKeysSvc from "@/server/domain/api-keys";

const createKeySchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name cannot exceed 100 characters")
});

export async function createApiKeyAction(
  _prev: ActionState<apiKeysSvc.CreatedApiKey> | undefined,
  formData: FormData
): Promise<ActionState<apiKeysSvc.CreatedApiKey>> {
  return runAction("api_key.create", async () => {
    const actor = await assertActor();
    const input = createKeySchema.parse(formValues(formData));
    const result = await apiKeysSvc.createApiKey(getDb(), actor, input);
    revalidatePath("/settings/api-keys");
    return result;
  });
}

const revokeKeySchema = z.object({
  keyId: z.string().uuid()
});

export async function revokeApiKeyAction(formData: FormData): Promise<void> {
  const actor = await assertActor();
  const input = revokeKeySchema.parse(formValues(formData));
  await apiKeysSvc.revokeApiKey(getDb(), actor, input.keyId);
  revalidatePath("/settings/api-keys");
}
