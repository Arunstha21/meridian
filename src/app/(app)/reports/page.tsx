import { requireVerifiedActor, currentFamily } from "@/server/auth/context";
import { getDb } from "@/server/db/client";
import {
  netWorthSeries,
  incomeExpenseSeries,
  spendingByCategory,
  currentMonthRange
} from "@/server/domain/reports";
import { getUserPrivacyMode } from "@/server/domain/users";
import { Card, PageHeader, EmptyState } from "@/components/ds/card";
import { Amount, Sparkline, BarRow } from "@/components/finance/amount";
import { fmtMoney, fmtMonth } from "@/lib/format";
import { PrintButton } from "./print-button";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const actor = await requireVerifiedActor();
  const family = await currentFamily(actor);
  const db = getDb();
  const privacy = await getUserPrivacyMode(db, actor.userId);

  const [series, flows, spend] = await Promise.all([
    netWorthSeries(db, family, actor.userId, 180),
    incomeExpenseSeries(db, family, actor.userId, 12),
    spendingByCategory(db, family, actor.userId, currentMonthRange(family.timezone))
  ]);

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Server-computed from your ledger. Transfers are excluded from income and spending."
        actions={<PrintButton />}
      />

      <Card>
        <h2 className="mb-3 text-sm font-medium text-muted">Net worth (last 6 months)</h2>
        <Sparkline points={series} masked={privacy} height={160} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-medium text-muted">Income vs spending by month</h2>
          {flows.length === 0 ? (
            <p className="text-sm text-muted">No data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                    <th scope="col" className="py-2 font-medium">Month</th>
                    <th scope="col" className="py-2 text-right font-medium">Income</th>
                    <th scope="col" className="py-2 text-right font-medium">Spending</th>
                    <th scope="col" className="py-2 text-right font-medium">Net</th>
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
                        <Amount minor={f.expenseMinor} currency={family.currency} masked={privacy} />
                      </td>
                      <td className="py-2 text-right tabular font-medium">
                        <Amount minor={f.incomeMinor - f.expenseMinor} currency={family.currency} masked={privacy} signed />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-medium text-muted">Spending this month by category</h2>
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
    </>
  );
}
