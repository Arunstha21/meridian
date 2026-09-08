"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDashboardData } from "@/components/finance/dashboard-data";
import { fmtDate, fmtMoney } from "@/lib/format";
import { ChevronRightIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

export function RecentTransactions() {
  const { recent, privacy } = useDashboardData();
  const router = useRouter();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base font-semibold">Recent transactions</CardTitle>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs"
          render={<Link href="/transactions" />}
        >
          See all
          <ChevronRightIcon className="size-3" />
        </Button>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <EmptyState
            variant="transactions"
            title="Nothing here yet"
            description="Add an account and record your first transaction."
            actionLabel="Add an account"
            onAction={() => {
              router.push("/accounts/new");
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[560px] space-y-1">
              <div className="grid grid-cols-[1fr_140px_120px_120px] gap-4 border-b pb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <span>Description</span>
                <span>Account</span>
                <span className="text-right">Amount</span>
                <span>Date</span>
              </div>
              {recent.map((entry) => {
                const displayMinor = -entry.amountMinor;
                return (
                  <Link
                    key={entry.id}
                    href={`/transactions/${entry.id}`}
                    className="group grid grid-cols-[1fr_140px_120px_120px] items-center gap-4 rounded-lg py-2.5 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {entry.transferId ? "⇄ " : ""}
                        {entry.name}
                      </p>
                      {entry.transferId ? (
                        <Badge
                          variant="secondary"
                          className="mt-0.5 h-5 rounded-md px-1.5 text-[10px]"
                        >
                          Transfer
                        </Badge>
                      ) : null}
                    </div>
                    <span className="truncate text-xs text-muted-foreground">
                      {entry.accountName}
                    </span>
                    <span
                      className={cn(
                        "text-right text-sm font-semibold tabular-nums",
                        displayMinor > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-foreground"
                      )}
                    >
                      {privacy
                        ? "•••••"
                        : `${displayMinor > 0 ? "+" : ""}${fmtMoney(displayMinor, entry.currency)}`}
                    </span>
                    <span className="text-xs text-muted-foreground">{fmtDate(entry.date)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
