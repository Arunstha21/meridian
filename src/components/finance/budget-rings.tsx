"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { fmtMoney } from "@/lib/format";
import {
  CarIcon,
  Gamepad2Icon,
  GraduationCapIcon,
  HeartPulseIcon,
  PlaneIcon,
  RepeatIcon,
  ShoppingBagIcon,
  UtensilsIcon
} from "lucide-react";

const icons = [
  <UtensilsIcon key="u" className="size-5" />,
  <CarIcon key="c" className="size-5" />,
  <Gamepad2Icon key="g" className="size-5" />,
  <ShoppingBagIcon key="s" className="size-5" />,
  <RepeatIcon key="r" className="size-5" />,
  <HeartPulseIcon key="h" className="size-5" />,
  <GraduationCapIcon key="e" className="size-5" />,
  <PlaneIcon key="p" className="size-5" />
];

const colors = [
  "text-emerald-500",
  "text-blue-500",
  "text-violet-500",
  "text-amber-500",
  "text-rose-500",
  "text-cyan-500",
  "text-pink-500",
  "text-orange-500"
];

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export type BudgetRingItem = {
  id: string;
  name: string;
  spentMinor: number;
  limitMinor: number;
  pct: number;
};

export function BudgetRings({
  items,
  currency,
  privacy,
  monthLabel
}: {
  items: BudgetRingItem[];
  currency: string;
  privacy: boolean;
  monthLabel: string;
}) {
  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Monthly budgets · {monthLabel}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {items.map((item, index) => {
            const percent = Math.min(item.pct * 100, 100);
            const offset = CIRCUMFERENCE - (percent / 100) * CIRCUMFERENCE;
            const isOver = item.pct >= 1;
            const color = colors[index % colors.length] ?? "text-primary";
            return (
              <div key={item.id} className="flex flex-col items-center gap-2">
                <div className="relative size-24">
                  <svg viewBox="0 0 100 100" className="size-full -rotate-90">
                    <circle
                      cx="50"
                      cy="50"
                      r={RADIUS}
                      fill="none"
                      stroke="var(--muted)"
                      strokeWidth="8"
                    />
                    <motion.circle
                      cx="50"
                      cy="50"
                      r={RADIUS}
                      fill="none"
                      stroke="currentColor"
                      className={isOver ? "text-destructive" : color}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={CIRCUMFERENCE}
                      initial={{ strokeDashoffset: CIRCUMFERENCE }}
                      animate={{ strokeDashoffset: offset }}
                      transition={{ duration: 1, delay: index * 0.1, ease: "easeOut" }}
                    />
                  </svg>
                  <div
                    className={cn(
                      "absolute inset-0 flex items-center justify-center",
                      isOver ? "text-destructive" : color
                    )}
                  >
                    {icons[index % icons.length]}
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium">{item.name}</p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {privacy ? "••••" : fmtMoney(item.spentMinor, currency)}{" "}
                    <span className="text-muted-foreground/60">
                      / {privacy ? "••••" : fmtMoney(item.limitMinor, currency)}
                    </span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
