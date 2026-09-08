import { describe, it, expect, beforeAll } from "vitest";
import { db, makeUser, makeAccount, addTxn, truncateAll, daysAgo, actorOf } from "../helpers";
import * as entriesSvc from "@/server/domain/entries";
import * as orchestrate from "@/server/domain/orchestrate";
import { errors } from "@/lib/errors";

beforeAll(async () => {
  await truncateAll();
});

describe("transaction entries", () => {
  it("creates transactions with the source sign convention (outflow positive, inflow negative)", async () => {
    const user = await makeUser();
    const accountId = await makeAccount(user, { openingBalanceDisplayMinor: 10000 });

    await addTxn(user, accountId, { amountLedgerMinor: 2500, name: "Coffee", date: daysAgo(2) });
    await addTxn(user, accountId, { amountLedgerMinor: -90000, name: "Salary", date: daysAgo(1) });

    const page = await entriesSvc.listEntriesPage(db(), actorOf(user), {});
    const amounts = page.items.map((i) => i.amountMinor).sort((a, b) => a - b);
    expect(amounts).toEqual([-90000, 2500]);
  });

  it("rejects zero amounts and invalid dates", async () => {
    const user = await makeUser();
    const accountId = await makeAccount(user);
    await expect(
      entriesSvc.createTransactionEntry(db(), actorOf(user), {
        accountId,
        date: daysAgo(1),
        amountLedgerMinor: 0,
        name: "Zero"
      })
    ).rejects.toMatchObject({ code: "validation.failed" });
    await expect(
      entriesSvc.createTransactionEntry(db(), actorOf(user), {
        accountId,
        date: "2026-02-30",
        amountLedgerMinor: 5,
        name: "BadDate"
      })
    ).rejects.toBeTruthy();
  });

  it("dedupes external ids idempotently per account+source", async () => {
    const user = await makeUser();
    const accountId = await makeAccount(user);

    const first = await orchestrate.addTransaction(db(), actorOf(user), {
      accountId,
      date: daysAgo(1),
      amountLedgerMinor: 1234,
      name: "Imported",
      externalSource: "csv",
      externalId: "row-42"
    });
    expect(first.duplicated).toBe(false);

    const second = await orchestrate.addTransaction(db(), actorOf(user), {
      accountId,
      date: daysAgo(1),
      amountLedgerMinor: 1234,
      name: "Imported again",
      externalSource: "csv",
      externalId: "row-42"
    });
    expect(second.duplicated).toBe(true);
    expect(second.entryId).toBe(first.entryId);

    const page = await entriesSvc.listEntriesPage(db(), actorOf(user), {});
    expect(page.items).toHaveLength(1);
  });

  it("filters by kind and search with keyset pagination", async () => {
    const user = await makeUser();
    const accountId = await makeAccount(user);
    for (let i = 0; i < 7; i++) {
      await addTxn(user, accountId, {
        amountLedgerMinor: 100 + i,
        name: `Expense alpha ${i}`,
        date: daysAgo(10 - i)
      });
    }
    await addTxn(user, accountId, { amountLedgerMinor: -5000, name: "Paycheck", date: daysAgo(0) });

    const expenses = await entriesSvc.listEntriesPage(db(), actorOf(user), { kind: "expense" });
    expect(expenses.items).toHaveLength(7);

    const search = await entriesSvc.listEntriesPage(db(), actorOf(user), { search: "alpha" });
    expect(search.items).toHaveLength(7);

    const p1 = await entriesSvc.listEntriesPage(db(), actorOf(user), { limit: 4 });
    expect(p1.items).toHaveLength(4);
    expect(p1.nextCursor).toBeTruthy();
    expect(p1.hasPrevious).toBe(false);
    const p2 = await entriesSvc.listEntriesPage(db(), actorOf(user), {
      limit: 4,
      cursor: p1.nextCursor
    });
    expect(p2.items.length + p1.items.length).toBe(8);
    expect(p2.hasPrevious).toBe(true);
    const back = await entriesSvc.listEntriesPage(db(), actorOf(user), {
      limit: 4,
      cursor: { date: p2.items[0]!.date, id: p2.items[0]!.id },
      direction: "prev"
    });
    expect(back.items.map((i) => i.id)).toEqual(p1.items.map((i) => i.id));
  });

  it("deletes entries atomically including transfer unlinking", async () => {
    const user = await makeUser();
    const a = await makeAccount(user);
    const b = await makeAccount(user);
    const outId = await addTxn(user, a, { amountLedgerMinor: 7000, date: daysAgo(3) });
    const inId = await addTxn(user, b, { amountLedgerMinor: -7000, date: daysAgo(3) });

    await orchestrate.linkTransfer(db(), actorOf(user), outId, inId);

    await orchestrate.removeEntry(db(), actorOf(user), outId);
    const detail = await entriesSvc.getEntryDetail(db(), actorOf(user), inId);
    expect(detail.transferId).toBeNull();
  });
});

describe("splits", () => {
  it("enforces sum invariant and leaf-only balance counting", async () => {
    const user = await makeUser();
    const accountId = await makeAccount(user, { openingBalanceDisplayMinor: 20000 });
    const parentId = await addTxn(user, accountId, {
      amountLedgerMinor: 6000,
      name: "Grocery mega-run"
    });

    await expect(
      orchestrate.splitTransaction(db(), actorOf(user), parentId, [
        { amountLedgerMinor: 4000 },
        { amountLedgerMinor: 1500 }
      ])
    ).rejects.toMatchObject({ code: "validation.failed" });

    const food = await (
      await import("@/server/domain/categories")
    ).createCategory(db(), actorOf(user), { name: "Food" });
    await orchestrate.splitTransaction(db(), actorOf(user), parentId, [
      { amountLedgerMinor: 4000, name: "Food part", categoryId: food.categoryId },
      { amountLedgerMinor: 2000, name: "Supplies part" }
    ]);

    const listed = await entriesSvc.listEntriesPage(db(), actorOf(user), {});
    expect(listed.items.map((i) => i.name).sort()).toEqual(["Food part", "Supplies part"]);
    expect(listed.items.find((i) => i.name === "Food part")?.categoryId).toBe(food.categoryId);
    expect(listed.items.some((i) => i.id === parentId)).toBe(false);

    const child = listed.items.find((i) => i.name === "Food part")!;
    const childDetail = await entriesSvc.getEntryDetail(db(), actorOf(user), child.id);
    expect(childDetail.parentId).toBe(parentId);

    const balance = (await import("../helpers")).latestBalance;
    const bal = await balance(accountId);
    expect(bal!.balanceMinor).toBe(14000);

    await orchestrate.unsplitTransaction(db(), actorOf(user), parentId);
    const restored = await balance(accountId);
    expect(restored!.balanceMinor).toBe(14000);
    const afterUnsplit = await entriesSvc.listEntriesPage(db(), actorOf(user), {});
    expect(afterUnsplit.items.map((i) => i.id)).toEqual([parentId]);
  });

  it("refuses splitting transfer legs", async () => {
    const user = await makeUser();
    const a = await makeAccount(user);
    const b = await makeAccount(user);
    const outId = await addTxn(user, a, { amountLedgerMinor: 800, date: daysAgo(2) });
    const inId = await addTxn(user, b, { amountLedgerMinor: -800, date: daysAgo(2) });
    await orchestrate.linkTransfer(db(), actorOf(user), outId, inId);

    await expect(
      orchestrate.splitTransaction(db(), actorOf(user), outId, [
        { amountLedgerMinor: 300 },
        { amountLedgerMinor: 500 }
      ])
    ).rejects.toMatchObject({ code: "conflict" });
  });
});

void errors;
