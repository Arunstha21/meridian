import { beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db, makeUser, truncateAll, actorOf, latestBalance } from "../helpers";
import { importSureExport, parseSureExport } from "@/server/domain/sure-import";

beforeAll(async () => {
  await truncateAll();
});

describe("Sure family import", () => {
  it("reads all.ndjson from Sure's standard ZIP export", () => {
    const ndjson = JSON.stringify({
      type: "Account",
      data: {
        id: "cash",
        name: "Cash",
        accountable_type: "Depository",
        balance: "0",
        currency: "USD"
      }
    });
    const parsed = parseSureExport("sure_export.zip", zipWithAllNdjson(ndjson));
    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0]).toMatchObject({ type: "Account", data: { name: "Cash" } });
  });

  it("imports ledger records, split transactions, transfers, and valuation-driven accounts into an empty family", async () => {
    const user = await makeUser({ familyName: "Migrated family" });
    const ndjson = [
      {
        type: "Account",
        data: {
          id: "cash",
          name: "Everyday",
          accountable_type: "Depository",
          balance: "15.00",
          currency: "USD",
          created_at: "2026-01-01"
        }
      },
      {
        type: "Account",
        data: {
          id: "savings",
          name: "Savings",
          accountable_type: "Depository",
          balance: "10.00",
          currency: "USD",
          created_at: "2026-01-01"
        }
      },
      {
        type: "Account",
        data: {
          id: "invest",
          name: "NEPSE",
          accountable_type: "Investment",
          balance: "100.00",
          currency: "NPR",
          created_at: "2026-01-01"
        }
      },
      { type: "Category", data: { id: "food", name: "Food", color: "orange" } },
      { type: "Tag", data: { id: "essential", name: "essential", color: "blue" } },
      {
        type: "Transaction",
        data: {
          id: "t-expense",
          account_id: "cash",
          date: "2026-08-10",
          amount: "10.00",
          name: "Groceries",
          category_id: "food",
          tag_ids: ["essential"]
        }
      },
      {
        type: "Transaction",
        data: {
          id: "t-income",
          account_id: "cash",
          date: "2026-08-11",
          amount: "-50.00",
          name: "Salary",
          tag_ids: []
        }
      },
      {
        type: "Transaction",
        data: {
          id: "t-split",
          account_id: "cash",
          date: "2026-08-12",
          amount: "20.00",
          name: "Shop",
          split_lines: [
            {
              id: "split-one",
              amount: "7.00",
              name: "Fruit",
              category_id: "food",
              tag_ids: ["essential"]
            },
            { id: "split-two", amount: "13.00", name: "Household", tag_ids: [] }
          ]
        }
      },
      {
        type: "Transaction",
        data: {
          id: "t-out",
          account_id: "cash",
          date: "2026-08-13",
          amount: "5.00",
          name: "Transfer",
          tag_ids: []
        }
      },
      {
        type: "Transaction",
        data: {
          id: "t-in",
          account_id: "savings",
          date: "2026-08-13",
          amount: "-5.00",
          name: "Transfer",
          tag_ids: []
        }
      },
      {
        type: "Transfer",
        data: {
          id: "move",
          outflow_transaction_id: "t-out",
          inflow_transaction_id: "t-in",
          status: "confirmed"
        }
      },
      {
        type: "Valuation",
        data: {
          id: "invest-value",
          account_id: "invest",
          date: "2026-08-15",
          amount: "95.00",
          currency: "NPR",
          name: "Closing value",
          kind: "current"
        }
      },
      { type: "Rule", data: { id: "unsupported" } }
    ]
      .map((row) => JSON.stringify(row))
      .join("\n");

    const result = await importSureExport(
      db(),
      actorOf(user),
      "sure-export.ndjson",
      new TextEncoder().encode(ndjson)
    );

    expect(result).toMatchObject({
      accounts: 3,
      categories: 1,
      tags: 1,
      transactions: 7,
      transfers: 1,
      valuations: 1,
      skipped: { Rule: 1 }
    });
    const balances = await db().execute<{ name: string; account_id: string }>(sql`
      SELECT name, id::text AS account_id FROM accounts WHERE family_id = ${user.familyId}::uuid ORDER BY name
    `);
    const ids = new Map((balances.rows ?? []).map((row) => [row.name, row.account_id]));
    expect((await latestBalance(ids.get("Everyday")!))?.balanceMinor).toBe(1500);
    expect((await latestBalance(ids.get("Savings")!))?.balanceMinor).toBe(1000);
    expect((await latestBalance(ids.get("NEPSE")!))?.balanceMinor).toBe(9500);

    const transfers = await db().execute<{ count: string }>(
      sql`SELECT count(*)::text AS count FROM transfers`
    );
    expect(transfers.rows?.[0]?.count).toBe("1");
  });

  it("refuses to merge a Sure archive into a family that already has data", async () => {
    const user = await makeUser();
    const existing = await db().execute(sql`
      INSERT INTO accounts (family_id, owner_id, type, name, currency, opening_balance_minor, opened_on)
      VALUES (${user.familyId}::uuid, ${user.userId}::uuid, 'depository', 'Existing', 'USD', 0, current_date)
    `);
    void existing;
    const ndjson = JSON.stringify({
      type: "Account",
      data: {
        id: "cash",
        name: "Cash",
        accountable_type: "Depository",
        balance: "0",
        currency: "USD"
      }
    });
    await expect(
      importSureExport(db(), actorOf(user), "sure.ndjson", new TextEncoder().encode(ndjson))
    ).rejects.toMatchObject({ code: "conflict" });
  });
});

function zipWithAllNdjson(contents: string): Uint8Array {
  const name = Buffer.from("all.ndjson");
  const data = Buffer.from(contents);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);

  const centralOffset = local.length + name.length + data.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + name.length, 12);
  end.writeUInt32LE(centralOffset, 16);

  return new Uint8Array(Buffer.concat([local, name, data, central, name, end]));
}
