import { requireVerifiedActor } from "@/server/auth/context";
import { getDb } from "@/server/db/client";
import { loadHistory } from "@/server/domain/chat";
import { pendingProposal } from "@/server/domain/chat-proposals";
import { aiChatEnabled } from "@/lib/env";
import { ChatClient } from "./chat-client";

export const metadata = { title: "Assistant" };

export default async function ChatPage() {
  const actor = await requireVerifiedActor();
  const enabled = aiChatEnabled();
  const db = getDb();
  const history = enabled ? await loadHistory(db, actor.familyId, actor.userId) : [];
  const pending = enabled ? await pendingProposal(db, actor) : null;
  const payload = pending?.payload as
    | {
        name: string;
        accountName: string;
        amountLedgerMinor: number;
        currency: string;
        date: string;
        merchant: string | null;
      }
    | undefined;

  return (
    <ChatClient
      enabled={enabled}
      userName={actor.name}
      initialProposal={
        pending && payload
          ? {
              id: pending.id,
              name: payload.name,
              accountName: payload.accountName,
              amountLedgerMinor: payload.amountLedgerMinor,
              currency: payload.currency,
              date: payload.date,
              merchant: payload.merchant
            }
          : null
      }
      initialMessages={history
        .filter((m) => m.role === "user" || m.role === "assistant")
        .filter((m) => m.content && m.content.trim().length > 0)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content ?? "" }))}
    />
  );
}
