"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireVerifiedActor } from "@/server/auth/context";
import { getDb } from "@/server/db/client";
import { accounts } from "@/server/db/schema";
import {
  createSeries,
  deleteSeries,
  setSeriesActive,
  skipNextOccurrence,
  type Frequency,
  type SeriesConfig
} from "@/server/domain/recurring";
import { runAction, type ActionState } from "@/server/actions/runner";
import { parseAmountToMinor } from "@/lib/money";
import { errors } from "@/lib/errors";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

const seriesSchema = z.object({
  name: z.string().min(1).max(240),
  accountId: z.string().uuid(),
  amount: z.string().min(1),
  kind: z.enum(["expense", "income"]).default("expense"),
  merchant: z.string().max(120).optional(),
  categoryId: z.string().uuid().or(z.literal("")).optional(),
  frequency: z.enum(["monthly", "weekly", "yearly"]),
  nextDue: isoDate
});

function configFor(frequency: Frequency, nextDue: string, form: FormData): SeriesConfig {
  switch (frequency) {
    case "weekly":
      return { weekday: Number(form.get("weekday") ?? "1") };
    case "yearly":
      return { month: Number(form.get("month") ?? "1"), day: Number(form.get("day") ?? "1") };
    case "monthly":
    default: {
      const explicit = form.get("dayOfMonth");
      const anchorDay = explicit ? Number(explicit) : Number(nextDue.slice(8, 10));
      return { dayOfMonth: anchorDay };
    }
  }
}

export async function createRecurringAction(_prev: ActionState | undefined, formData: FormData): Promise<ActionState> {
  return runAction("recurring.create", async () => {
    const input = seriesSchema.parse(Object.fromEntries(formData));
    const actor = await requireVerifiedActor();
    const db = getDb();

    const [account] = await db
      .select({ currency: accounts.currency })
      .from(accounts)
      .where(and(eq(accounts.id, input.accountId), eq(accounts.familyId, actor.familyId)))
      .limit(1);
    if (!account) throw errors.validation("Unknown account.");

    const magnitude = Math.abs(parseAmountToMinor(input.amount, account.currency));
    await createSeries(db, actor, {
      accountId: input.accountId,
      name: input.name,
      merchant: input.merchant ?? null,
      amountLedgerMinor: input.kind === "income" ? -magnitude : magnitude,
      categoryId: input.categoryId || null,
      frequency: input.frequency,
      config: configFor(input.frequency, input.nextDue, formData),
      nextDue: input.nextDue
    });
    revalidatePath("/settings/recurring");
    return undefined;
  });
}

export async function toggleRecurringAction(formData: FormData): Promise<void> {
  await runAction("recurring.toggle", async () => {
    const actor = await requireVerifiedActor();
    const id = String(formData.get("id") ?? "");
    const active = formData.get("active") === "true";
    await setSeriesActive(getDb(), actor, id, active);
    revalidatePath("/settings/recurring");
  });
}

export async function deleteRecurringAction(formData: FormData): Promise<void> {
  await runAction("recurring.delete", async () => {
    const actor = await requireVerifiedActor();
    await deleteSeries(getDb(), actor, String(formData.get("id") ?? ""));
    revalidatePath("/settings/recurring");
  });
}

export async function skipNextOccurrenceAction(formData: FormData): Promise<void> {
  await runAction("recurring.skip", async () => {
    const actor = await requireVerifiedActor();
    const id = String(formData.get("id") ?? "");
    await skipNextOccurrence(getDb(), actor, id);
    revalidatePath("/settings/recurring");
  });
}
