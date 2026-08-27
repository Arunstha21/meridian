import { and, asc, eq } from "drizzle-orm";
import type { Executor } from "../db/client";
import { chatMessages } from "../db/schema";
import type { ProviderMessage } from "../ai/provider";

export type ChatMessageRow = typeof chatMessages.$inferSelect;

export async function loadHistory(
  exec: Executor,
  familyId: string,
  userId: string,
  limit = 40
): Promise<ProviderMessage[]> {
  const rows = await exec
    .select()
    .from(chatMessages)
    .where(and(eq(chatMessages.familyId, familyId), eq(chatMessages.userId, userId)))
    .orderBy(asc(chatMessages.createdAt));

  // Drop the trailing user message (if any) so the caller's new message doesn't duplicate.
  const usable = rows.filter((r) => r.content !== "");
  return usable.slice(-limit).map((r) => ({
    role: r.role as ProviderMessage["role"],
    content: r.content,
    tool_calls: (r.toolCalls as ProviderMessage["tool_calls"]) ?? undefined,
    tool_call_id: r.toolCallId ?? undefined
  }));
}

export async function appendUserMessage(
  exec: Executor,
  familyId: string,
  userId: string,
  content: string
): Promise<void> {
  await exec.insert(chatMessages).values({ familyId, userId, role: "user", content });
}

export async function appendAssistantMessage(
  exec: Executor,
  familyId: string,
  userId: string,
  content: string
): Promise<void> {
  await exec.insert(chatMessages).values({ familyId, userId, role: "assistant", content });
}

export async function clearHistory(exec: Executor, familyId: string, userId: string): Promise<void> {
  await exec
    .delete(chatMessages)
    .where(and(eq(chatMessages.familyId, familyId), eq(chatMessages.userId, userId)));
}
