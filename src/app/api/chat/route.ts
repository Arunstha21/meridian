import { NextResponse } from "next/server";
import { z } from "zod";
import { loadActor } from "@/server/auth/context";
import type { Actor } from "@/server/auth/context";
import { getDb } from "@/server/db/client";
import type { Executor } from "@/server/db/client";
import { loadHistory, appendUserMessage, appendAssistantMessage } from "@/server/domain/chat";
import {
  claimProposalForConfirmation,
  dismissProposal
} from "@/server/domain/chat-proposals";
import { createTransactionEntry } from "@/server/domain/entries";
import { runAgent } from "@/server/ai/agent";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { aiChatEnabled } from "@/lib/env";
import { isDomainError } from "@/lib/errors";
import { fmtMoney } from "@/lib/format";
import { log } from "@/lib/logger";

const bodySchema = z.union([
  z.object({ message: z.string().min(1).max(4000) }),
  z.object({ confirmProposalId: z.string().uuid() }),
  z.object({ dismissProposalId: z.string().uuid() })
]);

const PROPOSAL_TTL_NOTE = "That proposal is no longer available. Ask again if you still want it.";

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

    if ("confirmProposalId" in parsed.data) {
      return await confirmTransaction(db, actor, parsed.data.confirmProposalId);
    }
    if ("dismissProposalId" in parsed.data) {
      return await dismissTransaction(db, actor, parsed.data.dismissProposalId);
    }

    const history = await loadHistory(db, actor.familyId, actor.userId);
    await appendUserMessage(db, actor.familyId, actor.userId, parsed.data.message);

    const result = await runAgent(db, actor, history, parsed.data.message);
    await appendAssistantMessage(db, actor.familyId, actor.userId, result.reply);
    const latest = result.proposals[result.proposals.length - 1];
    return NextResponse.json({ reply: result.reply, proposal: latest ?? null });
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

async function confirmTransaction(
  db: Executor,
  actor: Actor,
  proposalId: string
): Promise<NextResponse> {
  // The atomic claim means a double-clicked Confirm can only execute one write.
  const payload = await claimProposalForConfirmation(db, actor, proposalId);
  if (!payload) {
    return NextResponse.json({ error: PROPOSAL_TTL_NOTE }, { status: 410 });
  }

  const { entryId, duplicated } = await createTransactionEntry(db, actor, {
    accountId: payload.accountId,
    date: payload.date,
    amountLedgerMinor: payload.amountLedgerMinor,
    name: payload.name,
    merchant: payload.merchant,
    categoryId: payload.categoryId
  });

  const note = `Recorded "${payload.name}" — ${fmtMoney(payload.amountLedgerMinor, payload.currency)} on ${payload.date} in ${payload.accountName}${duplicated ? " (matched an existing entry)" : ""}.`;
  await appendUserMessage(db, actor.familyId, actor.userId, "(confirmed the proposed transaction)");
  await appendAssistantMessage(db, actor.familyId, actor.userId, note);

  return NextResponse.json({
    recorded: {
      entryId,
      note,
      name: payload.name,
      accountName: payload.accountName,
      amountLedgerMinor: payload.amountLedgerMinor,
      currency: payload.currency,
      date: payload.date
    }
  });
}

async function dismissTransaction(
  db: Executor,
  actor: Actor,
  proposalId: string
): Promise<NextResponse> {
  const dismissed = await dismissProposal(db, actor, proposalId);
  if (!dismissed) {
    return NextResponse.json({ error: PROPOSAL_TTL_NOTE }, { status: 410 });
  }
  await appendAssistantMessage(db, actor.familyId, actor.userId, "Okay — I discarded that proposal.");
  return NextResponse.json({ dismissed: true });
}
