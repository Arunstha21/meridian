"use client";

import { createContext, useContext } from "react";

export type DashboardAccount = {
  id: string;
  name: string;
  type: string;
  displayBalanceMinor: number;
  currency: string;
  institution: string | null;
  status: string;
};

export type DashboardEntry = {
  id: string;
  date: string;
  name: string;
  amountMinor: number;
  currency: string;
  accountName: string;
  transferId: string | null;
};

export type HealthFactor = {
  id: string;
  label: string;
  score: number;
  status: "excellent" | "good" | "fair" | "poor";
  description: string;
};

export type DashboardData = {
  greeting: string;
  dateLabel: string;
  currency: string;
  locale: string;
  privacy: boolean;
  netWorthMinor: number;
  assetsMinor: number;
  liabilitiesMinor: number;
  incomeThisMonthMinor: number;
  expenseThisMonthMinor: number;
  series: { date: string; valueMinor: number }[];
  flows: { monthKey: string; incomeMinor: number; expenseMinor: number }[];
  topCategories: { name: string; totalMinor: number }[];
  recent: DashboardEntry[];
  accounts: DashboardAccount[];
  budgetOverall: {
    limitMinor: number;
    spentMinor: number;
    remainingMinor: number;
    pct: number;
  } | null;
  health: {
    overall: number;
    trend: "up" | "down";
    trendDelta: number;
    factors: HealthFactor[];
    insufficientData?: boolean;
  };
};

const DashboardDataContext = createContext<DashboardData | null>(null);

export function DashboardDataProvider({
  data,
  children
}: {
  data: DashboardData;
  children: React.ReactNode;
}) {
  return <DashboardDataContext.Provider value={data}>{children}</DashboardDataContext.Provider>;
}

export function useDashboardData(): DashboardData {
  const ctx = useContext(DashboardDataContext);
  if (!ctx) {
    throw new Error("useDashboardData must be used inside a DashboardDataProvider");
  }
  return ctx;
}
