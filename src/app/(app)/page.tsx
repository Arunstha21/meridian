import Link from "next/link";
import { requireVerifiedActor, currentFamily } from "@/server/auth/context";
import { getDb } from "@/server/db/client";
import { dashboardSummary, netWorthSeries } from "@/server/domain/reports";
import { budgetOverview } from "@/server/domain/budgets";
import { getUserPrivacyMode } from "@/server/domain/users";
import { Card, PageHeader, EmptyState, Badge } from "@/components/ds/card";
import { Amount, BarRow } from "@/components/finance/amount";
import { NetWorthChart, RangePicker } from "@/components/finance/net-worth-chart";
import { fmtMoney } from "@/lib/format";
import { listAccountsForActor, isLiability } from "@/server/domain/accounts";

export const metadata = { title: "Dashboard" };

const NW_RANGES = new Set(["90", "180", "365", "all"]);

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ nw?: string }>;
}) {
  const actor = await requireVerifiedActor();
  const family = await currentFamily(actor);
  const db = getDb();
  const { nw } = await searchParams;
  const nwRange = nw && NW_RANGES.has(nw) ? nw : "90";
  const seriesDays = nwRange === "all" ? ("all" as const) : Number(nwRange);

  const [summary, accounts, series, budget] = await Promise.all([
    dashboardSummary(db, family, actor.userId),
    listAccountsForActor(db, actor),
    netWorthSeries(db, family, actor.userId, seriesDays),
    budgetOverview(db, family, actor.userId)
  ]);

  const privacy = await getUserPrivacyMode(db, actor.userId);
  const activeAccounts = accounts.filter((a) => a.status === "active");

  return (
    <>
      <PageHeader
        title={`Welcome back, ${actor.name.split(" ")[0]}`}
        subtitle={new Intl.DateTimeFormat(family.locale, {
          dateStyle: "full",
          timeZone: family.timezone
        }).format(new Date())}
        actions={
          <Link
            href="/accounts/new"
            className="hidden rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg sm:inline-flex"
          >
            + New account
          </Link>
        }
      />

      <div className="grid gap-6 sm:grid-cols-3">
        <Card className="min-h-[340px] sm:col-span-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-medium text-primary">Net worth</h2>
            <RangePicker value={nwRange} basePath="/" />
          </div>
          <p className="tabular mt-1 text-3xl font-semibold">
            <Amount minor={summary.netWorthMinor} currency={family.currency} masked={privacy} />
          </p>
          <div className="mt-4">
            <NetWorthChart points={series} currency={family.currency} masked={privacy} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted">Assets</p>
              <Amount
                minor={summary.assetsMinor}
                currency={family.currency}
                masked={privacy}
                className="font-medium"
              />
            </div>
            <div>
              <p className="text-muted">Liabilities</p>
              <Amount
                minor={summary.liabilitiesMinor}
                currency={family.currency}
                masked={privacy}
                className="font-medium"
              />
            </div>
          </div>
        </Card>

        <Card className="space-y-5">
          <div>
            <h2 className="text-base font-medium text-primary">Income this month</h2>
            <p className="tabular mt-1 text-xl font-semibold text-income">
              <Amount
                minor={summary.incomeThisMonthMinor}
                currency={family.currency}
                masked={privacy}
              />
            </p>
          </div>
          <div>
            <h2 className="text-base font-medium text-primary">Spending this month</h2>
            <p className="tabular mt-1 text-xl font-semibold">
              <Amount
                minor={summary.expenseThisMonthMinor}
                currency={family.currency}
                masked={privacy}
              />
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

      {budget.overall || budget.perCategory.length > 0 ? (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-medium text-primary">Budgets this month</h2>
            <Link href="/budgets" className="text-sm text-primary hover:underline">
              Manage
            </Link>
          </div>
          <div className="space-y-3">
            {budget.overall ? (
              <div>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span className="font-medium">Overall</span>
                  <span className="tabular text-muted">
                    {privacy
                      ? "•••••"
                      : `${fmtMoney(budget.overall.spentMinor, family.currency)} / ${fmtMoney(budget.overall.limitMinor, family.currency)}`}
                  </span>
                </div>
                <BarRow
                  label="Overall"
                  value={budget.overall.spentMinor}
                  total={budget.overall.limitMinor}
                  formatted={privacy ? "•••••" : `${Math.round(budget.overall.pct * 100)}%`}
                />
              </div>
            ) : null}
            {budget.perCategory
              .filter((b) => b.pct >= 0.8)
              .slice(0, 3)
              .map((b) => (
                <div key={b.categoryId ?? "x"}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="truncate">{b.categoryName}</span>
                    <span className="tabular text-muted">
                      {privacy
                        ? "•••••"
                        : `${fmtMoney(b.spentMinor, family.currency)} / ${fmtMoney(b.limitMinor, family.currency)}`}
                    </span>
                  </div>
                  <BarRow
                    label={b.categoryName}
                    value={b.spentMinor}
                    total={b.limitMinor}
                    formatted={privacy ? "•••••" : `${Math.round(b.pct * 100)}%`}
                  />
                </div>
              ))}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <h2 className="mb-4 text-base font-medium text-primary">Top spending by category</h2>
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
            <h2 className="text-base font-medium text-primary">Recent activity</h2>
            <Link href="/transactions" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
          {summary.recentEntries.length === 0 ? (
            <EmptyState
              title="Nothing here yet"
              hint="Add an account and record your first transaction."
              action={
                <Link
                  href="/accounts/new"
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg"
                >
                  Add an account
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {summary.recentEntries.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link
                      href={`/transactions/${e.id}`}
                      className="block truncate text-sm font-medium hover:underline"
                    >
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

      {activeAccounts.length === 0 ? (
        <Card>
          <h2 className="text-base font-medium text-primary">Get started</h2>
          <p className="mt-1 text-sm text-muted">
            Three steps to a working ledger. You can change currency and time zone later in
            Settings.
          </p>
          <ol className="mt-4 space-y-3 text-sm">
            <li className="rounded-lg border border-border px-3 py-2.5">
              <p className="font-medium">1. Confirm your household</p>
              <p className="text-muted">
                Reporting currency is {family.currency} in {family.timezone}.
              </p>
              <Link href="/settings" className="mt-1 inline-block text-primary hover:underline">
                Review settings
              </Link>
            </li>
            <li className="rounded-lg border border-border px-3 py-2.5">
              <p className="font-medium">2. Add your first account</p>
              <p className="text-muted">Cash, credit card, or another asset you want to track.</p>
              <Link
                href="/accounts/new"
                className="mt-2 inline-flex rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg"
              >
                Add an account
              </Link>
            </li>
            <li className="rounded-lg border border-border px-3 py-2.5">
              <p className="font-medium">3. Record a transaction</p>
              <p className="text-muted">Income, spending, or a transfer once you have an account.</p>
            </li>
          </ol>
        </Card>
      ) : null}

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-medium text-primary">Accounts</h2>
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
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm transition-colors hover:bg-surface-hover"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate">{a.name}</span>
                    {!a.isJoint && a.level === "read_only" ? (
                      <Badge tone="neutral">view only</Badge>
                    ) : null}
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
