import { NextResponse } from "next/server";
import { z } from "zod";
import { loadActor } from "@/server/auth/context";
import type { Actor } from "@/server/auth/context";
import { getDb, withTransaction } from "@/server/db/client";
import type { Executor } from "@/server/db/client";
import { requireEmailVerification } from "@/lib/env";
import { loadHistory, appendUserMessage, appendAssistantMessage } from "@/server/domain/chat";
import { claimProposalForConfirmation, dismissProposal } from "@/server/domain/chat-proposals";
import { addTransaction } from "@/server/domain/orchestrate";
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
const MAX_REQUEST_BYTES = 32 * 1024; // 32KB payload limit

export async function POST(request: Request): Promise<NextResponse> {
  // S11: Verify Content-Type is application/json
  const contentType = request.headers.get("content-type");
  if (!contentType || !contentType.toLowerCase().includes("application/json")) {
    return NextResponse.json(
      { error: "Unsupported Media Type: expected application/json." },
      { status: 415 }
    );
  }

  // S11: Verify Sec-Fetch-Site and Origin to prevent cross-site request forgery
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "same-site") {
    return NextResponse.json({ error: "Cross-site requests are forbidden." }, { status: 403 });
  }

  const origin = request.headers.get("origin");
  let host = request.headers.get("host");
  if (!host) {
    try {
      host = new URL(request.url).host;
    } catch {
      host = null;
    }
  }
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost !== host) {
        return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Malformed origin header." }, { status: 403 });
    }
  }

  // S11: Verify Content-Length within bounds
  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader && Number(contentLengthHeader) > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "Request payload exceeds 32KB limit." }, { status: 413 });
  }

  const rawText = await request.text().catch(() => "");
  if (rawText.length > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "Request payload exceeds 32KB limit." }, { status: 413 });
  }

  if (!aiChatEnabled()) {
    return NextResponse.json({ error: "AI chat is not configured." }, { status: 503 });
  }

  const actor = await loadActor();
  if (!actor) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (requireEmailVerification() && !actor.emailVerified) {
    return NextResponse.json({ error: "Verify your email address first." }, { status: 403 });
  }

  let raw: unknown = null;
  try {
    raw = JSON.parse(rawText);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

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
  _db: Executor,
  actor: Actor,
  proposalId: string
): Promise<NextResponse> {
  // Claim + ledger write share one transaction so a failed write leaves the
  // proposal pending (retryable) instead of confirmed-and-lost.
  const result = await withTransaction(async (tx) => {
    const payload = await claimProposalForConfirmation(tx, actor, proposalId);
    if (!payload) return { kind: "gone" as const };

    const { entryId, duplicated } = await addTransaction(tx, actor, {
      accountId: payload.accountId,
      date: payload.date,
      amountLedgerMinor: payload.amountLedgerMinor,
      name: payload.name,
      merchant: payload.merchant,
      categoryId: payload.categoryId
    });

    const note = `Recorded "${payload.name}" — ${fmtMoney(payload.amountLedgerMinor, payload.currency)} on ${payload.date} in ${payload.accountName}${duplicated ? " (matched an existing entry)" : ""}.`;
    await appendUserMessage(
      tx,
      actor.familyId,
      actor.userId,
      "(confirmed the proposed transaction)"
    );
    await appendAssistantMessage(tx, actor.familyId, actor.userId, note);
    return { kind: "ok" as const, payload, entryId, duplicated, note };
  });

  if (result.kind === "gone") {
    return NextResponse.json({ error: PROPOSAL_TTL_NOTE }, { status: 410 });
  }

  return NextResponse.json({
    recorded: {
      entryId: result.entryId,
      note: result.note,
      name: result.payload.name,
      accountName: result.payload.accountName,
      amountLedgerMinor: result.payload.amountLedgerMinor,
      currency: result.payload.currency,
      date: result.payload.date
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
  await appendAssistantMessage(
    db,
    actor.familyId,
    actor.userId,
    "Okay — I discarded that proposal."
  );
  return NextResponse.json({ dismissed: true });
}
