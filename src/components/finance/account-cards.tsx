"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDashboardData } from "@/components/finance/dashboard-data";
import { fmtMoney } from "@/lib/format";
import {
  BuildingIcon,
  CreditCardIcon,
  LandmarkIcon,
  NfcIcon,
  PlusIcon,
  TrendingUpIcon,
  WalletIcon
} from "lucide-react";

const typeStyle: Record<string, { style: string; chip: string; icon: React.ReactNode }> = {
  depository: {
    style: "bg-muted text-foreground",
    chip: "bg-foreground/10",
    icon: <LandmarkIcon className="size-5 opacity-30" />
  },
  credit_card: {
    style: "bg-primary text-primary-foreground",
    chip: "bg-primary-foreground/20",
    icon: <CreditCardIcon className="size-5 opacity-30" />
  },
  other_asset: {
    style: "bg-emerald-700 text-white",
    chip: "bg-white/20",
    icon: <TrendingUpIcon className="size-5 opacity-30" />
  },
  other_liability: {
    style: "bg-card text-card-foreground ring-1 ring-border",
    chip: "bg-foreground/10",
    icon: <BuildingIcon className="size-5 opacity-30" />
  }
};

export function AccountCards() {
  const { accounts, netWorthMinor, currency, privacy } = useDashboardData();
  const active = accounts.filter((account) => account.status === "active");
  const [order, setOrder] = useState(() => active.map((_, index) => index));

  const cycle = useCallback(() => {
    setOrder((prev) => {
      if (prev.length < 2) return prev;
      const next = [...prev];
      const front = next.pop();
      if (front === undefined) return prev;
      next.unshift(front);
      return next;
    });
  }, []);

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 pt-6">
        <AnimatePresence mode="wait">
          {active.length === 0 ? (
            <div className="flex h-[200px] flex-col items-center justify-center gap-3 text-center">
              <WalletIcon className="size-8 text-muted-foreground" />
              <p className="text-sm font-medium">No accounts yet</p>
              <Button size="sm" render={<Link href="/accounts/new" />}>
                Add an account
              </Button>
            </div>
          ) : (
            <div className="relative h-[200px]">
              {order.map((cardIndex, stackPos) => {
                const account = active[cardIndex];
                if (!account) return null;
                const look = typeStyle[account.type] ?? typeStyle.depository;
                const isFront = stackPos === order.length - 1;
                const maxOffset = 48 / Math.max(order.length - 1, 1);
                return (
                  <motion.button
                    key={account.id}
                    type="button"
                    onClick={cycle}
                    layout
                    animate={{
                      y: stackPos * Math.min(maxOffset, 16),
                      scale: 1 - (order.length - 1 - stackPos) * (0.12 / Math.max(order.length - 1, 1)),
                      zIndex: stackPos
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 28 }}
                    className={cn(
                      "absolute inset-x-0 flex h-[152px] cursor-pointer flex-col justify-between rounded-2xl px-5 py-4 text-left",
                      look?.style,
                      isFront ? "shadow-xl" : "shadow-md"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold tracking-wide">{account.name}</span>
                      {look?.icon}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={cn("h-7 w-10 rounded-md", look?.chip)} />
                      <NfcIcon className="size-4 opacity-20" />
                    </div>
                    <div className="flex items-end justify-between gap-3">
                      <span className="truncate font-mono text-[10px] tracking-widest opacity-40">
                        {account.institution ?? account.type.replaceAll("_", " ")}
                      </span>
                      <p className="text-xl font-bold tabular-nums tracking-tight">
                        {privacy ? "••••" : fmtMoney(account.displayBalanceMinor, account.currency)}
                      </p>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CreditCardIcon className="size-3.5" />
            <span>
              {active.length} {active.length === 1 ? "account" : "accounts"}
            </span>
          </div>
          <Button variant="outline" size="icon" className="size-7 rounded-full" render={<Link href="/accounts/new" />}>
            <PlusIcon className="size-3.5" />
            <span className="sr-only">Add account</span>
          </Button>
        </div>

        <div className="space-y-1.5 border-t pt-5">
          <p className="text-xs font-medium text-muted-foreground">Wallet balance</p>
          <p className="text-3xl font-bold tabular-nums tracking-tight">
            {privacy ? "••••••" : fmtMoney(netWorthMinor, currency)}
          </p>
          <p className="text-xs text-muted-foreground">Net worth across reportable accounts.</p>
        </div>
      </CardContent>
    </Card>
  );
}
