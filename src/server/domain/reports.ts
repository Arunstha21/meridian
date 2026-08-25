import { sql } from "drizzle-orm";
import type { Executor } from "../db/client";
import type { Family } from "../auth/context";
import { getRate, convertMinor } from "./exchange-rates";
import { captureDebugLog } from "../observability/debug-log";
import { addMonths, endOfMonth, monthKeyIn, monthKeyOf, startOfMonth } from "@/lib/datetime";

export type FxIssue = { base: string; quote: string; date: string };

export type ConversionContext = {
  issues: Map<string, FxIssue>;
};

function newConversionContext(): ConversionContext {
  return { issues: new Map() };
}

async function convertTo(
  exec: Executor,
  amountMinor: number,
  from: string,
  to: string,
  onDate: string,
  ctx: ConversionContext
): Promise<number> {
  if (from === to) return amountMinor;
  const rate = await getRate(exec, from, to, onDate);
  if (rate === null) {
    const key = `${from}:${to}`;
    if (!ctx.issues.has(key)) {
      ctx.issues.set(key, { base: from, quote: to, date: onDate });
    }
    return 0;
  }
  return convertMinor(amountMinor, rate);
}

export type DashboardSummary = {
  netWorthMinor: number;
  assetsMinor: number;
  liabilitiesMinor: number;
  incomeThisMonthMinor: number;
  expenseThisMonthMinor: number;
  topCategories: { categoryId: string | null; name: string; totalMinor: number }[];
  recentEntries: {
    id: string;
    date: string;
    name: string;
    amountMinor: number;
    currency: string;
    accountName: string;
    transferId: string | null;
  }[];
  monthKey: string;
};

const ACCESS_SQL = (userId: string) => sql`(
  a.owner_id IS NULL
  OR a.owner_id = ${userId}::uuid
  OR EXISTS (
    SELECT 1 FROM account_shares s
    WHERE s.account_id = a.id AND s.user_id = ${userId}::uuid
  )
)`;

export async function dashboardSummary(
  exec: Executor,
  family: Family,
  userId: string
): Promise<DashboardSummary> {
  const ctx = newConversionContext();
  const today = new Date().toISOString().slice(0, 10);
  const currency = family.currency;

  const balanceRows = await exec.execute<{
    account_id: string;
    balance_minor: string;
    currency: string;
    type: string;
  }>(sql`
    SELECT DISTINCT ON (b.account_id)
      b.account_id::text AS account_id, b.balance_minor::text AS balance_minor, b.currency, a.type
    FROM balances b
    JOIN accounts a ON a.id = b.account_id
    WHERE a.family_id = ${family.id}
      AND a.status = 'active'
      AND a.included_in_reports = true
      AND ${ACCESS_SQL(userId)}
      AND b.as_of <= current_date
    ORDER BY b.account_id, b.as_of DESC
  `);

  let assetsMinor = 0;
  let liabilitiesMinor = 0;
  let netWorth = 0;
  for (const r of balanceRows.rows ?? []) {
    const converted = await convertTo(exec, Number(r.balance_minor), r.currency, currency, today, ctx);
    if (r.type === "credit_card" || r.type === "other_liability") {
      liabilitiesMinor += -Math.min(0, converted);
    } else {
      assetsMinor += converted;
    }
    netWorth += converted;
  }

  const mk = monthKeyIn(family.timezone);
  const from = startOfMonth(`${mk}-01`);
  const to = endOfMonth(`${mk}-01`);

  const flows = await exec.execute<{ outflow_minor: string; inflow_minor: string; outflow_currency: string }>(sql`
    SELECT
      COALESCE(SUM(CASE WHEN e.amount_minor > 0 THEN e.amount_minor ELSE 0 END), 0)::text AS outflow_minor,
      COALESCE(SUM(CASE WHEN e.amount_minor < 0 THEN -e.amount_minor ELSE 0 END), 0)::text AS inflow_minor,
      e.currency AS outflow_currency
    FROM entries e
    JOIN accounts a ON a.id = e.account_id
    JOIN transactions t ON t.entry_id = e.id
    WHERE a.family_id = ${family.id}
      AND a.included_in_reports = true
      AND a.status = 'active'
      AND ${ACCESS_SQL(userId)}
      AND e.entryable_type = 'transaction'
      AND t.transfer_id IS NULL
      AND e.parent_entry_id IS NULL
      AND e.date BETWEEN ${from}::date AND ${to}::date
    GROUP BY e.currency
  `);

  let expenseThisMonthMinor = 0;
  let incomeThisMonthMinor = 0;
  for (const r of flows.rows ?? []) {
    expenseThisMonthMinor += await convertTo(
      exec,
      Number(r.outflow_minor),
      r.outflow_currency,
      currency,
      today,
      ctx
    );
    incomeThisMonthMinor += await convertTo(
      exec,
      Number(r.inflow_minor),
      r.outflow_currency,
      currency,
      today,
      ctx
    );
  }

  const categoryRows = await exec.execute<{
    category_id: string | null;
    name: string | null;
    total_minor: string;
    currency: string;
  }>(sql`
    SELECT t.category_id::text AS category_id, c.name, SUM(e.amount_minor)::text AS total_minor, e.currency
    FROM entries e
    JOIN accounts a ON a.id = e.account_id
    JOIN transactions t ON t.entry_id = e.id
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE a.family_id = ${family.id}
      AND a.included_in_reports = true
      AND a.status = 'active'
      AND ${ACCESS_SQL(userId)}
      AND e.entryable_type = 'transaction'
      AND t.transfer_id IS NULL
      AND e.parent_entry_id IS NULL
      AND e.amount_minor > 0
      AND e.date BETWEEN ${from}::date AND ${to}::date
    GROUP BY t.category_id, c.name, e.currency
    ORDER BY 4 DESC
  `);

  const catTotals = new Map<string, { categoryId: string | null; name: string; totalMinor: number }>();
  for (const r of categoryRows.rows ?? []) {
    const converted = await convertTo(
      exec,
      Number(r.total_minor),
      r.currency,
      currency,
      today,
      ctx
    );
    const key = r.category_id ?? "uncategorized";
    const existing = catTotals.get(key);
    catTotals.set(key, {
      categoryId: r.category_id,
      name: r.name ?? "Uncategorized",
      totalMinor: (existing?.totalMinor ?? 0) + converted
    });
  }
  const topCategories = [...catTotals.values()].sort((a, b) => b.totalMinor - a.totalMinor).slice(0, 5);

  const recent = await exec.execute<{
    id: string;
    date: string;
    name: string;
    amount_minor: string;
    currency: string;
    account_name: string;
    transfer_id: string | null;
  }>(sql`
    SELECT e.id::text AS id, e.date::text AS date, e.name, e.amount_minor::text AS amount_minor,
           e.currency, a.name AS account_name, t.transfer_id::text AS transfer_id
    FROM entries e
    JOIN accounts a ON a.id = e.account_id
    JOIN transactions t ON t.entry_id = e.id
    WHERE a.family_id = ${family.id}
      AND ${ACCESS_SQL(userId)}
      AND NOT EXISTS (SELECT 1 FROM entries c WHERE c.parent_entry_id = e.id)
    ORDER BY e.date DESC, e.created_at DESC
    LIMIT 8
  `);

  await reportFxIssues(exec, ctx, family.id, "dashboard");

  return {
    netWorthMinor: netWorth,
    assetsMinor,
    liabilitiesMinor,
    incomeThisMonthMinor,
    expenseThisMonthMinor,
    topCategories,
    recentEntries: (recent.rows ?? []).map((r) => ({
      id: r.id,
      date: r.date.slice(0, 10),
      name: r.name,
      amountMinor: Number(r.amount_minor),
      currency: r.currency,
      accountName: r.account_name,
      transferId: r.transfer_id
    })),
    monthKey: mk
  };
}

export async function reportFxIssues(
  exec: Executor,
  ctx: ConversionContext,
  familyId: string,
  source: string
): Promise<void> {
  for (const issue of ctx.issues.values()) {
    await captureDebugLog(exec, {
      category: "fx",
      level: "warn",
      message: `Missing exchange rate ${issue.base}->${issue.quote}; affected totals exclude those amounts`,
      source,
      providerKey: "exchange_rates",
      familyId,
      metadata: { ...issue }
    });
  }
  ctx.issues.clear();
}

export type NetWorthPoint = { date: string; valueMinor: number };

export async function netWorthSeries(
  exec: Executor,
  family: Family,
  userId: string,
  days = 90
): Promise<NetWorthPoint[]> {
  const ctx = newConversionContext();
  const res = await exec.execute<{ as_of: string; balance_minor: string; currency: string; type: string }>(sql`
    SELECT b.as_of::text AS as_of, b.balance_minor::text AS balance_minor, b.currency, a.type
    FROM balances b
    JOIN accounts a ON a.id = b.account_id
    WHERE a.family_id = ${family.id}
      AND a.status = 'active'
      AND a.included_in_reports = true
      AND ${ACCESS_SQL(userId)}
      AND b.as_of >= current_date - ${String(days)}::int
    ORDER BY b.as_of
  `);

  const byDate = new Map<string, number>();
  for (const r of res.rows ?? []) {
    const d = r.as_of.slice(0, 10);
    const converted = await convertTo(exec, Number(r.balance_minor), r.currency, family.currency, d, ctx);
    byDate.set(d, (byDate.get(d) ?? 0) + converted);
  }

  await reportFxIssues(exec, ctx, family.id, "net_worth_series");
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, valueMinor: v }));
}

export type MonthFlow = { monthKey: string; incomeMinor: number; expenseMinor: number };

export async function incomeExpenseSeries(
  exec: Executor,
  family: Family,
  userId: string,
  months = 12
): Promise<MonthFlow[]> {
  const ctx = newConversionContext();
  const currentMk = monthKeyIn(family.timezone);
  const startMk = addMonths(currentMk, -(months - 1));
  const fromDate = startOfMonth(`${startMk}-01`);
  const toDate = endOfMonth(`${currentMk}-01`);

  const res = await exec.execute<{ mk: string; currency: string; outflow: string; inflow: string }>(sql`
    SELECT to_char(e.date, 'YYYY-MM') AS mk, e.currency,
           COALESCE(SUM(CASE WHEN e.amount_minor > 0 THEN e.amount_minor ELSE 0 END), 0)::text AS outflow,
           COALESCE(SUM(CASE WHEN e.amount_minor < 0 THEN -e.amount_minor ELSE 0 END), 0)::text AS inflow
    FROM entries e
    JOIN accounts a ON a.id = e.account_id
    JOIN transactions t ON t.entry_id = e.id
    WHERE a.family_id = ${family.id}
      AND a.included_in_reports = true
      AND a.status = 'active'
      AND ${ACCESS_SQL(userId)}
      AND e.entryable_type = 'transaction'
      AND t.transfer_id IS NULL
      AND e.parent_entry_id IS NULL
      AND e.date BETWEEN ${fromDate}::date AND ${toDate}::date
    GROUP BY mk, e.currency
  `);

  const byMonth = new Map<string, MonthFlow>();
  for (let i = 0; i < months; i++) {
    const mk = addMonths(startMk, i);
    byMonth.set(mk, { monthKey: mk, incomeMinor: 0, expenseMinor: 0 });
  }

  for (const r of res.rows ?? []) {
    const entry = byMonth.get(r.mk);
    if (!entry) continue;
    const anchor = endOfMonth(`${r.mk}-01`);
    entry.expenseMinor += await convertTo(exec, Number(r.outflow), r.currency, family.currency, anchor, ctx);
    entry.incomeMinor += await convertTo(exec, Number(r.inflow), r.currency, family.currency, anchor, ctx);
  }

  await reportFxIssues(exec, ctx, family.id, "income_expense_series");
  return [...byMonth.values()];
}

export async function spendingByCategory(
  exec: Executor,
  family: Family,
  userId: string,
  range: { from: string; to: string }
): Promise<{ categoryId: string | null; name: string; totalMinor: number; share: number }[]> {
  const ctx = newConversionContext();
  const res = await exec.execute<{
    category_id: string | null;
    name: string | null;
    total_minor: string;
    currency: string;
  }>(sql`
    SELECT t.category_id::text AS category_id, c.name, SUM(e.amount_minor)::text AS total_minor, e.currency
    FROM entries e
    JOIN accounts a ON a.id = e.account_id
    JOIN transactions t ON t.entry_id = e.id
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE a.family_id = ${family.id}
      AND a.included_in_reports = true
      AND a.status = 'active'
      AND ${ACCESS_SQL(userId)}
      AND e.entryable_type = 'transaction'
      AND t.transfer_id IS NULL
      AND e.parent_entry_id IS NULL
      AND e.amount_minor > 0
      AND e.date BETWEEN ${range.from}::date AND ${range.to}::date
    GROUP BY t.category_id, c.name, e.currency
  `);

  const totals = new Map<string, { categoryId: string | null; name: string; totalMinor: number }>();
  let grand = 0;
  for (const r of res.rows ?? []) {
    const converted = await convertTo(exec, Number(r.total_minor), r.currency, family.currency, range.to, ctx);
    const key = r.category_id ?? "uncategorized";
    const existing = totals.get(key);
    const next = (existing?.totalMinor ?? 0) + converted;
    totals.set(key, { categoryId: r.category_id, name: r.name ?? "Uncategorized", totalMinor: next });
    grand += converted;
  }

  await reportFxIssues(exec, ctx, family.id, "spending_by_category");

  return [...totals.values()]
    .map((v) => ({ ...v, share: grand > 0 ? v.totalMinor / grand : 0 }))
    .sort((a, b) => b.totalMinor - a.totalMinor);
}

export function currentMonthRange(timezone: string): { from: string; to: string } {
  const mk = monthKeyIn(timezone);
  return { from: startOfMonth(`${mk}-01`), to: endOfMonth(`${mk}-01`) };
}

export function monthRangeOf(monthKey: string): { from: string; to: string } {
  return { from: startOfMonth(`${monthKey}-01`), to: endOfMonth(`${monthKey}-01`) };
}

export function monthOf(iso: string): string {
  return monthKeyOf(iso);
}
