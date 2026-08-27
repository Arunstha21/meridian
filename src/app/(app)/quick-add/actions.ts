"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { assertActor } from "@/server/auth/context";
import { getDb, withTransaction } from "@/server/db/client";
import { accounts } from "@/server/db/schema";
import { addTransaction } from "@/server/domain/orchestrate";
import { runAction, optionalString, type ActionState } from "@/server/actions/runner";
import { parseAmountToMinor } from "@/lib/money";

const quickSchema = z.object({
  accountId: z.string().uuid(),
  kind: z.enum(["expense", "income"]),
  date: z.string().min(8),
  amount: z.string().min(1),
  name: z.string().min(1).max(240),
  categoryId: z.string().optional()
});

export async function quickAddAction(
  _prev: ActionState<{ saved: boolean }> | undefined,
  formData: FormData
): Promise<ActionState<{ saved: boolean }>> {
  const parsed = quickSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Check the highlighted fields.", code: "validation.failed" };
  const input = parsed.data;
  return runAction("txn.quick_add", async () => {
    const actor = await assertActor();
    const [account] = await getDb().select().from(accounts).where(eq(accounts.id, input.accountId)).limit(1);
    if (!account || account.familyId !== actor.familyId) throw new Error("Unknown account.");

    const display = parseAmountToMinor(input.amount, account.currency);
    const amountLedgerMinor = input.kind === "expense" ? Math.abs(display) : -Math.abs(display);

    await withTransaction(async (tx) => {
      await addTransaction(tx, actor, {
        accountId: input.accountId,
        date: input.date,
        amountLedgerMinor,
        name: input.name,
        categoryId: optionalString(input.categoryId ?? undefined),
        merchant: null,
        notes: null
      });
    });
    revalidatePath("/transactions");
    revalidatePath("/");
    revalidatePath(`/accounts/${input.accountId}`);
    return { saved: true };
  });
}
