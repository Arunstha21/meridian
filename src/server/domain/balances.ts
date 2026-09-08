import { sql } from "drizzle-orm";
import type { Executor } from "../db/client";
import { balances as balancesTable } from "../db/schema";
import { isValuationDriven } from "../authorization/access";
import { addDays, diffDays, isIsoDate, minDate, todayIn } from "@/lib/datetime";
import { captureDebugLog } from "../observability/debug-log";
import { errors } from "@/lib/errors";

type AccountMeta = {
  id: string;
  currency: string;
  type: string;
  openingBalanceMinor: number;
  openedOn: string;
  timezone: string;
};

async function loadAccountMeta(exec: Executor, accountId: string): Promise<AccountMeta | null> {
  const res = await exec.execute<AccountMeta>(sql`
    SELECT a.id::text AS id, a.currency, a.type,
           a.opening_balance_minor::bigint::text AS opening_balance_minor,
           a.opened_on::text AS opened_on,
           f.timezone
    FROM accounts a
    JOIN families f ON f.id = a.family_id
    WHERE a.id = ${accountId}::uuid
  `);
  const row = (res.rows ?? [])[0] as
    | { id: string; currency: string; type: string; opening_balance_minor: string; opened_on: string; timezone: string }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    currency: row.currency,
    type: row.type,
    openingBalanceMinor: Number(row.opening_balance_minor),
    openedOn: row.opened_on.slice(0, 10),
    timezone: row.timezone
  };
}

export async function recalculateAccount(
  exec: Executor,
  accountId: string,
  fromDate?: string
): Promise<void> {
  const meta = await loadAccountMeta(exec, accountId);
  if (!meta) return;
  const today = todayIn(meta.timezone);

  let earliestEntry: string | null = null;
  if (isValuationDriven(meta.type)) {
    const res = await exec.execute<{ d: string }>(sql`
      SELECT MIN(date)::text AS d FROM entries
      WHERE account_id = ${accountId}::uuid AND entryable_type = 'valuation'
    `);
    earliestEntry = ((res.rows ?? [])[0]?.d ?? "").slice(0, 10) || null;
  } else {
    const res = await exec.execute<{ d: string }>(sql`
      SELECT MIN(date)::text AS d FROM entries e
      WHERE e.account_id = ${accountId}::uuid
        AND e.entryable_type = 'transaction'
        AND NOT EXISTS (SELECT 1 FROM entries c WHERE c.parent_entry_id = e.id)
    `);
    earliestEntry = ((res.rows ?? [])[0]?.d ?? "").slice(0, 10) || null;
  }

  let start = meta.openedOn;
  if (earliestEntry) start = minDate(start, earliestEntry);
  if (fromDate && isIsoDate(fromDate)) start = minDate(start, fromDate);
  if (start > today) {
    await exec.execute(sql`DELETE FROM balances WHERE account_id = ${accountId}::uuid`);
    return;
  }

  const dayCount = Math.max(1, diffDays(today, start) + 1);
  const MAX_SUPPORTED_DAYS = 36500; // 100 years
  if (dayCount > MAX_SUPPORTED_DAYS) {
    throw errors.validation(
      `Account history span of ${dayCount} days exceeds the maximum supported limit (${MAX_SUPPORTED_DAYS} days).`
    );
  }

  const eventsByDate = new Map<string, number>();
  if (isValuationDriven(meta.type)) {
    const res = await exec.execute<{ d: string; amount: string }>(sql`
      SELECT date::text AS d, amount_minor::text AS amount
      FROM entries
      WHERE account_id = ${accountId}::uuid AND entryable_type = 'valuation' AND date <= ${today}::date
      ORDER BY date ASC
    `);
    for (const r of res.rows ?? []) {
      eventsByDate.set(r.d.slice(0, 10), Number(r.amount));
    }
  } else {
    const res = await exec.execute<{ d: string; total: string }>(sql`
      SELECT date::text AS d, COALESCE(SUM(amount_minor), 0)::text AS total
      FROM entries e
      WHERE e.account_id = ${accountId}::uuid
        AND e.entryable_type = 'transaction'
        AND e.date <= ${today}::date
        AND NOT EXISTS (SELECT 1 FROM entries c WHERE c.parent_entry_id = e.id)
      GROUP BY date
    `);
    for (const r of res.rows ?? []) {
      eventsByDate.set(r.d.slice(0, 10), Number(r.total));
    }
  }

  const priorTotal = isValuationDriven(meta.type)
    ? 0
    : (
        await exec.execute<{ total: string }>(sql`
          SELECT COALESCE(SUM(amount_minor), 0)::text AS total
          FROM entries e
          WHERE e.account_id = ${accountId}::uuid
            AND e.entryable_type = 'transaction'
            AND e.date < ${start}::date
            AND NOT EXISTS (SELECT 1 FROM entries c WHERE c.parent_entry_id = e.id)
        `)
      ).rows?.[0]?.total ?? "0";

  const rows: { accountId: string; asOf: string; balanceMinor: number; currency: string }[] = [];
  let displayBalance = meta.openingBalanceMinor - Number(priorTotal);
  if (isValuationDriven(meta.type)) displayBalance = meta.openingBalanceMinor;

  let cursor = start;
  while (cursor <= today) {
    if (isValuationDriven(meta.type)) {
      const event = eventsByDate.get(cursor);
      if (event !== undefined) displayBalance = event;
    } else {
      const delta = eventsByDate.get(cursor);
      if (delta !== undefined) displayBalance -= delta;
    }
    rows.push({ accountId, asOf: cursor, balanceMinor: displayBalance, currency: meta.currency });
    cursor = addDays(cursor, 1);
  }

  await exec.transaction(async (tx) => {
    await tx.execute(sql`DELETE FROM balances WHERE account_id = ${accountId}::uuid AND as_of >= ${start}::date`);
    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      await tx.insert(balancesTable).values(
        chunk.map((r) => ({
          accountId: r.accountId,
          asOf: r.asOf,
          balanceMinor: r.balanceMinor,
          currency: r.currency
        }))
      );
    }
  });
}

export async function latestBalancesFor(
  exec: Executor,
  accountIds: string[]
): Promise<Map<string, { balanceMinor: number; currency: string; asOf: string }>> {
  if (accountIds.length === 0) return new Map();
  const res = await exec.execute<{ account_id: string; balance_minor: string; currency: string; as_of: string }>(sql`
    SELECT DISTINCT ON (account_id)
      account_id::text AS account_id, balance_minor::text AS balance_minor, currency, as_of::text AS as_of
    FROM balances
    WHERE account_id IN (${sql.join(accountIds.map((id) => sql`${id}::uuid`), sql`, `)})
    ORDER BY account_id, as_of DESC
  `);
  const map = new Map<string, { balanceMinor: number; currency: string; asOf: string }>();
  for (const r of res.rows ?? []) {
    map.set(r.account_id, { balanceMinor: Number(r.balance_minor), currency: r.currency, asOf: r.as_of });
  }
  return map;
}
