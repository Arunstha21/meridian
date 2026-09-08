import { describe, it, expect, beforeAll } from "vitest";
import { sql } from "drizzle-orm";
import { db, makeUser, makeAccount, addTxn, truncateAll, actorOf, daysAgo } from "../helpers";
import * as entriesSvc from "@/server/domain/entries";
import * as splitsSvc from "@/server/domain/splits";
import * as transfersSvc from "@/server/domain/transfers";
import * as orchestrate from "@/server/domain/orchestrate";
import * as accountsSvc from "@/server/domain/accounts";
import * as valuationsSvc from "@/server/domain/valuations";
import * as balancesSvc from "@/server/domain/balances";
import * as exchangeRatesSvc from "@/server/domain/exchange-rates";
import * as reportsSvc from "@/server/domain/reports";
import { getFamilyById } from "@/server/domain/families";
import { convertMinor } from "@/server/domain/exchange-rates";

beforeAll(async () => {
  await truncateAll();
});

describe("F01: Split Invariants", () => {
  it("rejects directly editing split parent amount", async () => {
    const user = await makeUser();
    const acct = await makeAccount(user);
    const parentId = await addTxn(user, acct, { amountLedgerMinor: 10000 });

    await orchestrate.splitTransaction(db(), actorOf(user), parentId, [
      { amountLedgerMinor: 4000 },
      { amountLedgerMinor: 6000 }
    ]);

    await expect(
      entriesSvc.updateTransactionEntry(db(), actorOf(user), parentId, {
        amountLedgerMinor: 12000
      })
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("rejects editing a split child if the sum does not match the parent", async () => {
    const user = await makeUser();
    const acct = await makeAccount(user);
    const parentId = await addTxn(user, acct, { amountLedgerMinor: 10000 });

    await orchestrate.splitTransaction(db(), actorOf(user), parentId, [
      { amountLedgerMinor: 4000 },
      { amountLedgerMinor: 6000 }
    ]);

    const children = await db().execute<{ id: string }>(
      sql`SELECT id::text FROM entries WHERE parent_entry_id = ${parentId}::uuid ORDER BY amount_minor ASC`
    );
    const childId = children.rows[0]!.id;

    await expect(
      entriesSvc.updateTransactionEntry(db(), actorOf(user), childId, {
        amountLedgerMinor: 5000 // Total would be 11000 != 10000
      })
    ).rejects.toMatchObject({ code: "validation.failed" });
  });

  it("allows editing a split child when the total still matches the parent", async () => {
    const user = await makeUser();
    const acct = await makeAccount(user);
    const parentId = await addTxn(user, acct, { amountLedgerMinor: 10000 });

    await orchestrate.splitTransaction(db(), actorOf(user), parentId, [
      { amountLedgerMinor: 4000 },
      { amountLedgerMinor: 6000 }
    ]);

    const children = await db().execute<{ id: string }>(
      sql`SELECT id::text FROM entries WHERE parent_entry_id = ${parentId}::uuid ORDER BY amount_minor ASC`
    );
    const child1Id = children.rows[0]!.id;

    // Editing non-amount fields (name/notes) works
    await entriesSvc.updateTransactionEntry(db(), actorOf(user), child1Id, {
      name: "Updated split part 1"
    });
    const updated = await entriesSvc.getEntryDetail(db(), actorOf(user), child1Id);
    expect(updated.entry.name).toBe("Updated split part 1");
  });

  it("cascades parent date update to split children and rejects child date deviation", async () => {
    const user = await makeUser();
    const acct = await makeAccount(user);
    const originalDate = daysAgo(5);
    const newDate = daysAgo(2);
    const parentId = await addTxn(user, acct, { amountLedgerMinor: 10000, date: originalDate });

    await orchestrate.splitTransaction(db(), actorOf(user), parentId, [
      { amountLedgerMinor: 4000 },
      { amountLedgerMinor: 6000 }
    ]);

    const children = await db().execute<{ id: string; date: string }>(
      sql`SELECT id::text, date::text FROM entries WHERE parent_entry_id = ${parentId}::uuid`
    );
    expect(children.rows[0]!.date.slice(0, 10)).toBe(originalDate);

    // Reject child date deviation
    await expect(
      entriesSvc.updateTransactionEntry(db(), actorOf(user), children.rows[0]!.id, {
        date: newDate
      })
    ).rejects.toMatchObject({ code: "validation.failed" });

    // Update parent date cascades to children
    await entriesSvc.updateTransactionEntry(db(), actorOf(user), parentId, {
      date: newDate
    });

    const childrenAfter = await db().execute<{ date: string }>(
      sql`SELECT date::text FROM entries WHERE parent_entry_id = ${parentId}::uuid`
    );
    for (const c of childrenAfter.rows) {
      expect(c.date.slice(0, 10)).toBe(newDate);
    }
  });

  it("rejects direct deletion of an individual split child", async () => {
    const user = await makeUser();
    const acct = await makeAccount(user);
    const parentId = await addTxn(user, acct, { amountLedgerMinor: 10000 });

    await orchestrate.splitTransaction(db(), actorOf(user), parentId, [
      { amountLedgerMinor: 4000 },
      { amountLedgerMinor: 6000 }
    ]);

    const children = await db().execute<{ id: string }>(
      sql`SELECT id::text FROM entries WHERE parent_entry_id = ${parentId}::uuid`
    );

    await expect(
      entriesSvc.deleteEntry(db(), actorOf(user), children.rows[0]!.id)
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("deleting a split parent deletes all children within the transaction", async () => {
    const user = await makeUser();
    const acct = await makeAccount(user);
    const parentId = await addTxn(user, acct, { amountLedgerMinor: 10000 });

    await orchestrate.splitTransaction(db(), actorOf(user), parentId, [
      { amountLedgerMinor: 4000 },
      { amountLedgerMinor: 6000 }
    ]);

    await entriesSvc.deleteEntry(db(), actorOf(user), parentId);

    const remaining = await db().execute<{ count: number }>(
      sql`SELECT count(*)::int FROM entries WHERE id = ${parentId}::uuid OR parent_entry_id = ${parentId}::uuid`
    );
    expect(remaining.rows[0]!.count).toBe(0);
  });

  it("rejects nested splits", async () => {
    const user = await makeUser();
    const acct = await makeAccount(user);
    const parentId = await addTxn(user, acct, { amountLedgerMinor: 10000 });

    await orchestrate.splitTransaction(db(), actorOf(user), parentId, [
      { amountLedgerMinor: 4000 },
      { amountLedgerMinor: 6000 }
    ]);

    const children = await db().execute<{ id: string }>(
      sql`SELECT id::text FROM entries WHERE parent_entry_id = ${parentId}::uuid`
    );

    await expect(
      splitsSvc.splitEntry(db(), actorOf(user), children.rows[0]!.id, [
        { amountLedgerMinor: 2000 },
        { amountLedgerMinor: 2000 }
      ])
    ).rejects.toMatchObject({ code: "validation.failed" });
  });
});

describe("F02: Transfer Invariants", () => {
  it("rejects editing amount or date of a linked transfer leg", async () => {
    const user = await makeUser();
    const acctA = await makeAccount(user);
    const acctB = await makeAccount(user);

    const transfer = await orchestrate.makeTransferWithEntries(db(), actorOf(user), {
      fromAccountId: acctA,
      toAccountId: acctB,
      amountDisplayMinor: 5000,
      date: daysAgo(1)
    });

    await expect(
      entriesSvc.updateTransactionEntry(db(), actorOf(user), transfer.outflowEntryId, {
        amountLedgerMinor: 8000
      })
    ).rejects.toMatchObject({ code: "conflict" });

    await expect(
      entriesSvc.updateTransactionEntry(db(), actorOf(user), transfer.inflowEntryId, {
        date: daysAgo(3)
      })
    ).rejects.toMatchObject({ code: "conflict" });

    // Annotation edits (name, notes) are permitted
    await entriesSvc.updateTransactionEntry(db(), actorOf(user), transfer.outflowEntryId, {
      name: "Transfer annotation update"
    });
    const updated = await entriesSvc.getEntryDetail(db(), actorOf(user), transfer.outflowEntryId);
    expect(updated.entry.name).toBe("Transfer annotation update");
  });

  it("rejects linking split transactions or split parts as transfers", async () => {
    const user = await makeUser();
    const acctA = await makeAccount(user);
    const acctB = await makeAccount(user);

    const parentId = await addTxn(user, acctA, { amountLedgerMinor: 5000, date: daysAgo(1) });
    const inId = await addTxn(user, acctB, { amountLedgerMinor: -5000, date: daysAgo(1) });

    await orchestrate.splitTransaction(db(), actorOf(user), parentId, [
      { amountLedgerMinor: 2000 },
      { amountLedgerMinor: 3000 }
    ]);

    // Parent cannot be linked
    await expect(
      transfersSvc.createTransferFromTransactions(db(), actorOf(user), parentId, inId)
    ).rejects.toMatchObject({ code: "validation.failed" });

    // Child cannot be linked
    const children = await db().execute<{ id: string }>(
      sql`SELECT id::text FROM entries WHERE parent_entry_id = ${parentId}::uuid`
    );
    await expect(
      transfersSvc.createTransferFromTransactions(db(), actorOf(user), children.rows[0]!.id, inId)
    ).rejects.toMatchObject({ code: "validation.failed" });
  });
});

describe("F03: Closed Account Mutation Rules", () => {
  it("enforces closed account immutability on edits, deletions, splits, and valuations", async () => {
    const user = await makeUser();
    const acct = await makeAccount(user);
    const entryId = await addTxn(user, acct, { amountLedgerMinor: 5000 });

    // Close the account
    await accountsSvc.setAccountStatus(db(), actorOf(user), acct, "disabled");

    // Edits rejected
    await expect(
      entriesSvc.updateTransactionEntry(db(), actorOf(user), entryId, { name: "New Name" })
    ).rejects.toMatchObject({ code: "conflict" });

    // Deletions rejected
    await expect(
      entriesSvc.deleteEntry(db(), actorOf(user), entryId)
    ).rejects.toMatchObject({ code: "conflict" });

    // Splitting rejected
    await expect(
      splitsSvc.splitEntry(db(), actorOf(user), entryId, [
        { amountLedgerMinor: 2000 },
        { amountLedgerMinor: 3000 }
      ])
    ).rejects.toMatchObject({ code: "conflict" });

    // Valuations rejected
    await expect(
      valuationsSvc.recordValuation(db(), actorOf(user), {
        accountId: acct,
        date: daysAgo(1),
        amountDisplayMinor: 10000
      })
    ).rejects.toMatchObject({ code: "conflict" });
  });
});

describe("F04: Extended History Balance Recalculation", () => {
  it("recalculates balances correctly for accounts opened over 4,000 days ago", async () => {
    const user = await makeUser();
    // 5000 days ago is ~13.7 years ago
    const openedOn = "2005-01-01";
    const acctId = (
      await accountsSvc.createAccount(db(), actorOf(user), {
        type: "depository",
        name: "Historical Account",
        currency: "USD",
        openingBalanceDisplayMinor: 0,
        openedOn,
        includedInReports: true,
        joint: false
      })
    ).accountId;

    // Add income of $100.00 (-10000 ledger minor)
    await addTxn(user, acctId, {
      amountLedgerMinor: -10000,
      date: daysAgo(10)
    });

    const accounts = await accountsSvc.listAccountsForActor(db(), actorOf(user));
    const target = accounts.find((a) => a.id === acctId);
    expect(target).toBeDefined();
    expect(target!.displayBalanceMinor).toBe(10000);
  });
});

describe("F05: FX Conversion Across Different Exponents", () => {
  it("converts between 0-decimal JPY and 2-decimal USD accurately", () => {
    // 10,000 JPY (exponent 0) at 0.01 USD/JPY rate = $100.00 = 10,000 USD cents
    const converted = convertMinor(10000, "0.01", "JPY", "USD");
    expect(converted).toBe(10000);

    // 10,000 USD cents ($100.00) at 100 JPY/USD rate = 10,000 JPY (exponent 0)
    const convertedBack = convertMinor(10000, "100", "USD", "JPY");
    expect(convertedBack).toBe(10000);
  });

  it("converts between 3-decimal BHD and 2-decimal USD accurately", () => {
    // 1,000 BHD fils (1.000 BHD, exponent 3) at 2.65 USD/BHD rate = $2.65 = 265 USD cents
    const converted = convertMinor(1000, "2.65", "BHD", "USD");
    expect(converted).toBe(265);
  });

  it("reports multi-currency net worth accurately on the dashboard", async () => {
    const user = await makeUser({ currency: "USD" });
    const jpyAcct = (
      await accountsSvc.createAccount(db(), actorOf(user), {
        type: "depository",
        name: "Tokyo Account",
        currency: "JPY",
        openingBalanceDisplayMinor: 0,
        openedOn: daysAgo(10),
        includedInReports: true,
        joint: false
      })
    ).accountId;

    // Add 10,000 JPY income (-10000 ledger)
    await addTxn(user, jpyAcct, {
      amountLedgerMinor: -10000,
      date: daysAgo(1)
    });

    await exchangeRatesSvc.upsertRate(db(), {
      base: "JPY",
      quote: "USD",
      rate: "0.01",
      quotedOn: daysAgo(1)
    });

    const family = await getFamilyById(db(), user.familyId);
    const summary = await reportsSvc.dashboardSummary(db(), family!, user.userId);

    // 10,000 JPY = $100.00 = 10,000 USD minor
    expect(summary.netWorthMinor).toBe(10000);
    expect(summary.incompleteFx).toBeFalsy();
  });
});

describe("F07: Liability Signs in Opening Balances and Valuations", () => {
  it("stores positive opening debt as negative ledger balance and reduces net worth", async () => {
    const user = await makeUser({ currency: "USD" });

    // Open credit card with $500 debt entered as positive 50000
    const ccId = (
      await accountsSvc.createAccount(db(), actorOf(user), {
        type: "credit_card",
        name: "Visa Card",
        currency: "USD",
        openingBalanceDisplayMinor: 50000,
        openedOn: daysAgo(10),
        includedInReports: true,
        joint: false
      })
    ).accountId;

    // Check account ledger balance
    const accounts = await accountsSvc.listAccountsForActor(db(), actorOf(user));
    const cc = accounts.find((a) => a.id === ccId);
    expect(cc).toBeDefined();
    expect(cc!.displayBalanceMinor).toBe(-50000);

    const family = await getFamilyById(db(), user.familyId);
    const summary = await reportsSvc.dashboardSummary(db(), family!, user.userId);

    expect(summary.netWorthMinor).toBe(-50000);
    expect(summary.liabilitiesMinor).toBe(50000);
  });

  it("records valuation debt on liability accounts correctly", async () => {
    const user = await makeUser({ currency: "USD" });

    const loanId = (
      await accountsSvc.createAccount(db(), actorOf(user), {
        type: "other_liability",
        name: "Auto Loan",
        currency: "USD",
        openingBalanceDisplayMinor: 0,
        openedOn: daysAgo(10),
        includedInReports: true,
        joint: false
      })
    ).accountId;

    // Record valuation update of $12,000 debt entered as 1200000
    await valuationsSvc.recordValuation(db(), actorOf(user), {
      accountId: loanId,
      date: daysAgo(1),
      amountDisplayMinor: 1200000,
      kind: "current"
    });

    await balancesSvc.recalculateAccount(db(), loanId);

    const accounts = await accountsSvc.listAccountsForActor(db(), actorOf(user));
    const loan = accounts.find((a) => a.id === loanId);
    expect(loan).toBeDefined();
    expect(loan!.displayBalanceMinor).toBe(-1200000);

    const family = await getFamilyById(db(), user.familyId);
    const summary = await reportsSvc.dashboardSummary(db(), family!, user.userId);

    expect(summary.netWorthMinor).toBe(-1200000);
    expect(summary.liabilitiesMinor).toBe(1200000);
  });
});
