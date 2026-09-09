"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { loadAccessIdentity } from "@/server/auth/context";
import { getDb } from "@/server/db/client";
import { registerAccessHousehold } from "@/server/domain/access-users";
import { errors } from "@/lib/errors";
import { runAction, type ActionState } from "@/server/actions/runner";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  familyName: z.string().trim().min(1).max(120),
  currency: z.string().length(3),
  timezone: z.string().min(1).max(100)
});

export async function createAccessHouseholdAction(
  _previous: ActionState | undefined,
  formData: FormData
): Promise<ActionState> {
  return runAction("auth.access_household", async () => {
    const identity = await loadAccessIdentity();
    if (!identity) throw errors.unauthorized();
    const input = schema.parse(Object.fromEntries(formData));
    await registerAccessHousehold(getDb(), identity, input);
    redirect("/");
  });
}
