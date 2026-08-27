import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db, makeUser, makeAccount, truncateAll, actorOf } from "../helpers";
import {
  createProposal,
  claimProposalForConfirmation,
  dismissProposal,
  pendingProposal,
  purgeExpiredProposals
} from "@/server/domain/chat-proposals";
import { createTransactionEntry } from "@/server/domain/entries";
import { chatProposals, entries } from "@/server/db/schema";

beforeAll(async () => {
  await truncateAll();
});

const PAYLOAD = (accountId: string, accountName: string) => ({
  accountId,
  accountName,
  name: "Coffee",
  amountLedgerMinor: 450,
  currency: "USD",
  date: "2026-08-27",
  merchant: "Cafe",
  categoryId: null
});

describe("chat proposal confirmation gate", () => {
  it("creates at most one pending proposal and returns its payload exactly once on confirm", async () => {
    const user = await makeUser();
    const actor = actorOf(user);
    const accountId = await makeAccount(user);

    const first = await createProposal(db(), actor, PAYLOAD(accountId, "Checking"));
    expect(first.status).toBe("pending");

    // A second proposal supersedes the first.
    const second = await createProposal(db(), actor, PAYLOAD(accountId, "Checking"));
    const pending = await pendingProposal(db(), actor);
    expect(pending?.id).toBe(second.id);
    expect(pending?.id).not.toBe(first.id);

    const claimed = await claimProposalForConfirmation(db(), actor, second.id);
    expect(claimed).toMatchObject({ accountId, amountLedgerMinor: 450 });

    // A second claim (double-clicked Confirm) yields nothing.
    expect(await claimProposalForConfirmation(db(), actor, second.id)).toBeNull();
  });

  it("records the entry only after a successful claim", async () => {
    const user = await makeUser();
    const actor = actorOf(user);
    const accountId = await makeAccount(user);

    const proposal = await createProposal(db(), actor, PAYLOAD(accountId, "Checking"));
    const payload = await claimProposalForConfirmation(db(), actor, proposal.id);
    if (!payload) throw new Error("claim failed");

    const { entryId, duplicated } = await createTransactionEntry(db(), actor, {
      accountId: payload.accountId,
      date: payload.date,
      amountLedgerMinor: payload.amountLedgerMinor,
      name: payload.name,
      merchant: payload.merchant,
      categoryId: payload.categoryId
    });
    expect(duplicated).toBe(false);

    const [row] = await db()
      .select({ amount: entries.amountMinor, name: entries.name })
      .from(entries)
      .where(eq(entries.id, entryId));
    expect(row?.amount).toBe(450);
    expect(row?.name).toBe("Coffee");
  });

  it("never confirms an expired proposal", async () => {
    const user = await makeUser();
    const actor = actorOf(user);
    const accountId = await makeAccount(user);

    const proposal = await createProposal(db(), actor, PAYLOAD(accountId, "Checking"));
    await db().execute(
      sql`UPDATE chat_proposals SET expires_at = now() - interval '1 second' WHERE id = ${proposal.id}::uuid`
    );

    expect(await claimProposalForConfirmation(db(), actor, proposal.id)).toBeNull();
    expect(await pendingProposal(db(), actor)).toBeNull();
  });

  it("does not let another user confirm or see the proposal", async () => {
    const owner = await makeUser();
    const other = await makeUser();
    const accountId = await makeAccount(owner);

    const proposal = await createProposal(db(), actorOf(owner), PAYLOAD(accountId, "Checking"));

    expect(await claimProposalForConfirmation(db(), actorOf(other), proposal.id)).toBeNull();
    expect(await pendingProposal(db(), actorOf(other))).toBeNull();
    // Still claimable by the owner after the foreign attempt.
    expect(await claimProposalForConfirmation(db(), actorOf(owner), proposal.id)).toMatchObject({
      accountId
    });
  });

  it("dismisses a pending proposal and purges stale rows", async () => {
    const user = await makeUser();
    const actor = actorOf(user);
    const accountId = await makeAccount(user);

    const proposal = await createProposal(db(), actor, PAYLOAD(accountId, "Checking"));
    expect(await dismissProposal(db(), actor, proposal.id)).toBe(true);
    // Second dismiss finds nothing pending.
    expect(await dismissProposal(db(), actor, proposal.id)).toBe(false);
    expect(await pendingProposal(db(), actor)).toBeNull();

    // Expired pendings flip to 'expired' on the next write.
    const stale = await createProposal(db(), actor, PAYLOAD(accountId, "Checking"));
    await db().execute(
      sql`UPDATE chat_proposals SET expires_at = now() - interval '1 minute' WHERE id = ${stale.id}::uuid`
    );
    await purgeExpiredProposals(db());
    const [row] = await db()
      .select({ status: chatProposals.status })
      .from(chatProposals)
      .where(eq(chatProposals.id, stale.id));
    expect(row?.status).toBe("expired");
  });
});
