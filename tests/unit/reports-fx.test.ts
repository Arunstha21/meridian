import { describe, expect, it } from "vitest";
import type { Executor } from "@/server/db/client";
import { netWorthMinorForAccounts } from "@/server/domain/reports";

function stubExec(rate: string | null): Executor {
  return {
    execute: async () => ({ rows: rate === null ? [] : [{ rate }] }),
    insert: () => ({ values: async () => undefined })
  } as unknown as Executor;
}

const family = { id: "00000000-0000-0000-0000-000000000001", currency: "USD" };
const ON = "2026-08-27";

describe("netWorthMinorForAccounts", () => {
  it("sums directly when every account is already in the family currency", async () => {
    const total = await netWorthMinorForAccounts(
      stubExec(null),
      family,
      [
        { displayBalanceMinor: 1500, currency: "USD" },
        { displayBalanceMinor: -500, currency: "USD" }
      ],
      ON
    );
    expect(total).toBe(1000);
  });

  it("converts foreign-currency balances through the exchange rate", async () => {
    const total = await netWorthMinorForAccounts(
      stubExec("0.01"),
      family,
      [
        { displayBalanceMinor: 1500, currency: "USD" },
        { displayBalanceMinor: 9500, currency: "NPR" }
      ],
      ON
    );
    expect(total).toBe(1595);
  });

  it("excludes accounts with no known rate instead of raw-summing them", async () => {
    const total = await netWorthMinorForAccounts(
      stubExec(null),
      family,
      [
        { displayBalanceMinor: 1500, currency: "USD" },
        { displayBalanceMinor: 9500, currency: "NPR" }
      ],
      ON
    );
    expect(total).toBe(1500);
  });
});
