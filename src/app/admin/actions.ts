"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { requireSuperAdmin } from "@/server/auth/context";
import { formValues } from "@/server/actions/runner";
import { setFlagEnabled } from "@/server/flags";
import { replayDeadJob } from "@/server/queue";

const flagSchema = z.object({ key: z.string().min(1), enabled: z.enum(["on", "off"]) });

export async function toggleFlagAction(formData: FormData): Promise<void> {
  "use server";
  await requireSuperAdmin();
  const parsed = flagSchema.safeParse(formValues(formData));
  if (!parsed.success) return;
  await setFlagEnabled(getDb(), parsed.data.key, parsed.data.enabled === "on");
  revalidatePath("/admin");
}

export async function replayJobAction(formData: FormData): Promise<void> {
  "use server";
  await requireSuperAdmin();
  const jobId = String(formData.get("jobId") ?? "");
  if (!jobId) return;
  await replayDeadJob(getDb(), jobId);
  revalidatePath("/admin");
}
