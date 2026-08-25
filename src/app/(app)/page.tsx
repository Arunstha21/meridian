import Link from "next/link";
import { requireVerifiedActor, currentFamily } from "@/server/auth/context";
import { getDb } from "@/server/db/client";
import { dashboardSummary, netWorthSeries } from "@/server/domain/reports";
import { getUserPrivacyMode } from "@/server/domain/users";
import { Card, PageHeader, EmptyState, Badge } from "@/components/ds/card";
import { Amount, Sparkline, BarRow } from "@/components/finance/amount";
import { fmtMoney } from "@/lib/format";
import { listAccountsForActor, isLiability } from "@/server/domain/accounts";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const actor = await requireVerifiedActor();
  const family = await currentFamily(actor);
  const db = getDb();

  const [summary, accounts, series] = await Promise.all([
    dashboardSummary(db, family, actor.userId),
    listAccountsForActor(db, actor),
    netWorthSeries(db, family, actor.userId, 90)
  ]);

  const privacy = await getUserPrivacyMode(db, actor.userId);
  const activeAccounts = accounts.filter((a) => a.status === "active");

  return (
    <>
      <PageHeader
        title={`Welcome back, ${actor.name.split(" ")[0]}`}
        subtitle={new Intl.DateTimeFormat(family.locale, { dateStyle: "full", timeZone: family.timezone }).format(new Date())}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="sm:col-span-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium text-muted">Net worth</h2>
          </div>
          <p className="tabular mt-1 text-3xl font-semibold">
            <Amount minor={summary.netWorthMinor} currency={family.currency} masked={privacy} />
          </p>
          <div className="mt-4">
            <Sparkline points={series} masked={privacy} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted">Assets</p>
              <Amount minor={summary.assetsMinor} currency={family.currency} masked={privacy} className="font-medium" />
            </div>
            <div>
              <p className="text-muted">Liabilities</p>
              <Amount minor={summary.liabilitiesMinor} currency={family.currency} masked={privacy} className="font-medium" />
            </div>
          </div>
        </Card>

        <Card className="space-y-4">
          <div>
            <h2 className="text-sm font-medium text-muted">Income this month</h2>
            <p className="tabular mt-1 text-xl font-semibold text-income">
              <Amount minor={summary.incomeThisMonthMinor} currency={family.currency} masked={privacy} />
            </p>
          </div>
          <div>
            <h2 className="text-sm font-medium text-muted">Spending this month</h2>
            <p className="tabular mt-1 text-xl font-semibold">
              <Amount minor={summary.expenseThisMonthMinor} currency={family.currency} masked={privacy} />
            </p>
          </div>
          <Link
            href="/reports"
            className="inline-block text-sm text-primary underline-offset-4 hover:underline"
          >
            View reports →
          </Link>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <h2 className="mb-4 text-sm font-medium text-muted">Top spending by category</h2>
          {summary.topCategories.length === 0 ? (
            <p className="text-sm text-muted">No spending recorded this month.</p>
          ) : (
            <div className="space-y-3">
              {summary.topCategories.map((c) => (
                <BarRow
                  key={c.categoryId ?? "uncategorized"}
                  label={c.name}
                  value={c.totalMinor}
                  total={summary.topCategories[0]?.totalMinor ?? c.totalMinor}
                  formatted={privacy ? "•••••" : fmtMoney(c.totalMinor, family.currency)}
                />
              ))}
            </div>
          )}
        </Card>

        <Card className="lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted">Recent activity</h2>
            <Link href="/transactions" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
          {summary.recentEntries.length === 0 ? (
            <EmptyState
              title="Nothing here yet"
              hint="Add an account and record your first transaction."
              action={
                <Link href="/accounts/new" className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg">
                  Add an account
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {summary.recentEntries.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/transactions/${e.id}`} className="block truncate text-sm font-medium hover:underline">
                      {e.transferId ? "⇄ " : ""}
                      {e.name}
                    </Link>
                    <p className="truncate text-xs text-muted">{e.accountName}</p>
                  </div>
                  <Amount
                    minor={-e.amountMinor}
                    currency={e.currency}
                    masked={privacy}
                    signed
                    colorize
                    className="shrink-0 text-sm"
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted">Accounts</h2>
          <Link href="/accounts" className="text-sm text-primary hover:underline">
            Manage
          </Link>
        </div>
        {activeAccounts.length === 0 ? (
          <p className="text-sm text-muted">No active accounts yet.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {activeAccounts.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/accounts/${a.id}`}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm hover:bg-border/30"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate">{a.name}</span>
                    {!a.isJoint && a.level === "read_only" ? <Badge tone="neutral">view only</Badge> : null}
                  </span>
                  <Amount
                    minor={a.displayBalanceMinor}
                    currency={a.currency}
                    masked={privacy}
                    colorize={isLiability(a.type)}
                    className="shrink-0 tabular text-muted"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
