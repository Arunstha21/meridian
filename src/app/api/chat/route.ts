import { NextResponse } from "next/server";
import { z } from "zod";
import { loadActor } from "@/server/auth/context";
import { getDb } from "@/server/db/client";
import { loadHistory, appendUserMessage, appendAssistantMessage } from "@/server/domain/chat";
import { runAgent } from "@/server/ai/agent";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { aiChatEnabled } from "@/lib/env";
import { isDomainError } from "@/lib/errors";
import { log } from "@/lib/logger";

const bodySchema = z.object({ message: z.string().min(1).max(4000) });

export async function POST(request: Request): Promise<NextResponse> {
  if (!aiChatEnabled()) {
    return NextResponse.json({ error: "AI chat is not configured." }, { status: 503 });
  }

  const actor = await loadActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const raw = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid message." }, { status: 400 });

  const db = getDb();

  try {
    await consumeRateLimit(db, `chat:${actor.userId}`, 60, 3600);

    const history = await loadHistory(db, actor.familyId, actor.userId);
    await appendUserMessage(db, actor.familyId, actor.userId, parsed.data.message);

    const result = await runAgent(db, actor, history, parsed.data.message);
    await appendAssistantMessage(db, actor.familyId, actor.userId, result.reply);
    return NextResponse.json({ reply: result.reply });
  } catch (e) {
    if (isDomainError(e)) {
      return NextResponse.json({ error: e.userMessage }, { status: e.status });
    }
    log.error({ err: e, userId: actor.userId }, "chat.request.failed");
    return NextResponse.json(
      { error: "The assistant could not respond. Try again shortly." },
      { status: 502 }
    );
  }
}
