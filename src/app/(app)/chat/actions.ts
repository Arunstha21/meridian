"use server";

import { revalidatePath } from "next/cache";
import { requireVerifiedActor } from "@/server/auth/context";
import { getDb } from "@/server/db/client";
import { clearHistory } from "@/server/domain/chat";
import { runAction } from "@/server/actions/runner";

export async function clearChatAction(): Promise<void> {
  await runAction("chat.clear", async () => {
    const actor = await requireVerifiedActor();
    await clearHistory(getDb(), actor.familyId, actor.userId);
    revalidatePath("/chat");
  });
}
