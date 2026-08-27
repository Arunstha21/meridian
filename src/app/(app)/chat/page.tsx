import { requireVerifiedActor } from "@/server/auth/context";
import { getDb } from "@/server/db/client";
import { loadHistory } from "@/server/domain/chat";
import { aiChatEnabled } from "@/lib/env";
import { ChatClient } from "./chat-client";

export const metadata = { title: "Assistant" };

export default async function ChatPage() {
  const actor = await requireVerifiedActor();
  const enabled = aiChatEnabled();
  const history = enabled ? await loadHistory(getDb(), actor.familyId, actor.userId) : [];

  return (
    <ChatClient
      enabled={enabled}
      userName={actor.name}
      initialMessages={history
        .filter((m) => m.role === "user" || m.role === "assistant")
        .filter((m) => m.content && m.content.trim().length > 0)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content ?? "" }))}
    />
  );
}
