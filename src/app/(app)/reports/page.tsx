import { requireVerifiedActor, currentFamily } from "@/server/auth/context";
import { getDb } from "@/server/db/client";
import { netWorthSeries, incomeExpenseSeries, spendingByCategory } from "@/server/domain/reports";
import { getUserPrivacyMode } from "@/server/domain/users";
import { Card, PageHeader, EmptyState } from "@/components/ds/card";
import { Amount, Sparkline, BarRow } from "@/components/finance/amount";
import { fmtMoney, fmtMonth } from "@/lib/format";
import { addMonths, endOfMonth, monthKeyIn, startOfMonth } from "@/lib/datetime";
import { PrintButton } from "./print-button";

export const metadata = { title: "Reports" };

const PERIODS = [
  { key: "monthly", label: "Monthly", months: 1, days: 30 },
  { key: "quarterly", label: "Quarterly", months: 3, days: 90 },
  { key: "ytd", label: "Year to date", months: 12, days: 365 },
  { key: "six_months", label: "Last 6 months", months: 6, days: 180 }
] as const;

type PeriodKey = (typeof PERIODS)[number]["key"];

export default async function ReportsPage({
  searchParams
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const actor = await requireVerifiedActor();
  const family = await currentFamily(actor);
  const db = getDb();
  const privacy = await getUserPrivacyMode(db, actor.userId);
  const requestedPeriod = (await searchParams).period;
  const period = PERIODS.some((item) => item.key === requestedPeriod)
    ? (requestedPeriod as PeriodKey)
    : "monthly";
  const selected = PERIODS.find((item) => item.key === period) ?? PERIODS[0];
  const currentMonth = monthKeyIn(family.timezone);
  const periodMonths = period === "ytd" ? Number(currentMonth.slice(5, 7)) : selected.months;
  const periodRange = {
    from: startOfMonth(`${addMonths(currentMonth, -(periodMonths - 1))}-01`),
    to: endOfMonth(`${currentMonth}-01`)
  };

  const [series, flows, spend] = await Promise.all([
    netWorthSeries(db, family, actor.userId, selected.days),
    incomeExpenseSeries(db, family, actor.userId, periodMonths),
    spendingByCategory(db, family, actor.userId, periodRange)
  ]);
  const latestIncome = flows.reduce((total, flow) => total + flow.incomeMinor, 0);
  const latestExpense = flows.reduce((total, flow) => total + flow.expenseMinor, 0);
  const latestNet = latestIncome - latestExpense;
  const topSpend = spend[0];

  return (
    <div className="space-y-6 pb-6 lg:pb-12">
      <PageHeader
        title="Reports"
        subtitle="Server-computed from your ledger. Transfers are excluded from income and spending."
        actions={<PrintButton />}
      />

      <div className="flex items-center justify-between gap-4 overflow-x-auto">
        <div
          className="flex max-w-fit gap-1 rounded-lg bg-surface-inset p-1"
          role="tablist"
          aria-label="Report period"
        >
          {PERIODS.map((item) => (
            <a
              key={item.key}
              href={`/reports?period=${item.key}`}
              role="tab"
              aria-selected={period === item.key}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                period === item.key
                  ? "bg-surface text-primary shadow-sm"
                  : "text-muted hover:bg-surface-hover"
              }`}
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm text-muted">Income · {selected.label}</p>
          <p className="tabular mt-2 text-2xl font-semibold text-income">
            <Amount minor={latestIncome} currency={family.currency} masked={privacy} />
          </p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Spending · {selected.label}</p>
          <p className="tabular mt-2 text-2xl font-semibold">
            <Amount minor={latestExpense} currency={family.currency} masked={privacy} />
          </p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Net savings</p>
          <p
            className={`tabular mt-2 text-2xl font-semibold ${latestNet >= 0 ? "text-income" : "text-destructive"}`}
          >
            <Amount minor={latestNet} currency={family.currency} masked={privacy} signed />
          </p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Top category</p>
          <p className="mt-2 truncate text-lg font-semibold">
            {topSpend?.name ?? "No spending yet"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {topSpend
              ? `${Math.round(topSpend.share * 100)}% of spending`
              : "Add transactions to see trends"}
          </p>
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 text-base font-medium text-primary">Net worth · {selected.label}</h2>
        <Sparkline points={series} masked={privacy} height={160} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-base font-medium text-primary">Income vs spending by month</h2>
          {flows.length === 0 ? (
            <p className="text-sm text-muted">No data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                    <th scope="col" className="py-2 font-medium">
                      Month
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      Income
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      Spending
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      Net
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[...flows].reverse().map((f) => (
                    <tr key={f.monthKey}>
                      <td className="py-2">{fmtMonth(f.monthKey)}</td>
                      <td className="py-2 text-right tabular">
                        <Amount minor={f.incomeMinor} currency={family.currency} masked={privacy} />
                      </td>
                      <td className="py-2 text-right tabular">
                        <Amount
                          minor={f.expenseMinor}
                          currency={family.currency}
                          masked={privacy}
                        />
                      </td>
                      <td className="py-2 text-right tabular font-medium">
                        <Amount
                          minor={f.incomeMinor - f.expenseMinor}
                          currency={family.currency}
                          masked={privacy}
                          signed
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-base font-medium text-primary">
            Spending · {selected.label} by category
          </h2>
          {spend.length === 0 ? (
            <EmptyState title="No spending recorded this month" />
          ) : (
            <div className="space-y-3">
              {spend.slice(0, 10).map((c) => (
                <BarRow
                  key={c.categoryId ?? "uncategorized"}
                  label={c.name}
                  value={c.totalMinor}
                  total={spend[0]?.totalMinor ?? c.totalMinor}
                  formatted={
                    privacy
                      ? "•••••"
                      : `${fmtMoney(c.totalMinor, family.currency)} · ${Math.round(c.share * 100)}%`
                  }
                />
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
