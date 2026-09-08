"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useDashboardData, type HealthFactor } from "@/components/finance/dashboard-data";
import {
  ChevronRightIcon,
  HeartPulseIcon,
  LineChartIcon,
  PiggyBankIcon,
  ReceiptIcon,
  ShieldIcon,
  ShoppingCartIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  XIcon
} from "lucide-react";

function getScoreGradient(score: number) {
  if (score >= 80) return { from: "#10b981", to: "#34d399" };
  if (score >= 60) return { from: "#3b82f6", to: "#60a5fa" };
  if (score >= 40) return { from: "#f59e0b", to: "#fbbf24" };
  return { from: "#ef4444", to: "#f87171" };
}

function getScoreLabel(score: number) {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Needs work";
}

const statusColor: Record<HealthFactor["status"], { bg: string; text: string; fill: string }> = {
  excellent: { bg: "bg-emerald-500/10", text: "text-emerald-500", fill: "#10b981" },
  good: { bg: "bg-blue-500/10", text: "text-blue-500", fill: "#3b82f6" },
  fair: { bg: "bg-amber-500/10", text: "text-amber-500", fill: "#f59e0b" },
  poor: { bg: "bg-rose-500/10", text: "text-rose-500", fill: "#ef4444" }
};

const factorIcons: Record<string, React.ReactNode> = {
  savings: <PiggyBankIcon className="size-4" />,
  spending: <ShoppingCartIcon className="size-4" />,
  networth: <LineChartIcon className="size-4" />,
  budget: <ReceiptIcon className="size-4" />,
  activity: <ShieldIcon className="size-4" />
};

function AnimatedCounter({ target }: { target: number }) {
  const shouldReduceMotion = useReducedMotion();
  const [val, setVal] = useState(0);
  const ref = useRef(0);

  useEffect(() => {
    if (shouldReduceMotion) return;
    const start = ref.current;
    const diff = target - start;
    const startTime = performance.now();
    const duration = 1200;

    function tick(now: number) {
      const elapsed = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - elapsed, 3);
      const current = Math.round(start + diff * ease);
      setVal(current);
      if (elapsed < 1) requestAnimationFrame(tick);
      else ref.current = target;
    }
    requestAnimationFrame(tick);
  }, [target, shouldReduceMotion]);

  if (shouldReduceMotion) return <>{target}</>;
  return <>{val}</>;
}

const GAUGE_W = 180;
const GAUGE_H = 100;
const STROKE = 10;
const ARC_R = (GAUGE_W - STROKE) / 2;
const ARC_CX = GAUGE_W / 2;
const ARC_CY = GAUGE_H - STROKE / 2;
const HALF_CIRC = Math.PI * ARC_R;

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = {
    x: cx + r * Math.cos((startAngle * Math.PI) / 180),
    y: cy + r * Math.sin((startAngle * Math.PI) / 180)
  };
  const end = {
    x: cx + r * Math.cos((endAngle * Math.PI) / 180),
    y: cy + r * Math.sin((endAngle * Math.PI) / 180)
  };
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function ScoreGauge({ score }: { score: number }) {
  const shouldReduceMotion = useReducedMotion();
  const { from, to } = getScoreGradient(score);
  const trackPath = describeArc(ARC_CX, ARC_CY, ARC_R, -180, 0);
  const scoreGap = HALF_CIRC - (score / 100) * HALF_CIRC;

  return (
    <div className="relative flex items-center justify-center">
      <motion.div
        className="absolute top-0 h-[90px] w-[160px] rounded-full blur-3xl"
        style={{ background: `radial-gradient(ellipse, ${from}18 0%, transparent 70%)` }}
        animate={shouldReduceMotion ? { opacity: 0.4 } : { opacity: [0.3, 0.55, 0.3] }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <svg width={GAUGE_W} height={GAUGE_H} viewBox={`0 0 ${GAUGE_W} ${GAUGE_H}`} className="overflow-visible">
        <defs>
          <linearGradient id="health-gauge-grad" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor={from} stopOpacity={0.25} />
            <stop offset="50%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        <path
          d={trackPath}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          opacity={0.2}
        />
        <motion.path
          d={trackPath}
          fill="none"
          stroke="url(#health-gauge-grad)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${HALF_CIRC}`}
          initial={{ strokeDashoffset: HALF_CIRC }}
          animate={{ strokeDashoffset: scoreGap }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute bottom-0 flex flex-col items-center">
        <span className="text-3xl font-bold tabular-nums tracking-tight">
          <AnimatedCounter target={score} />
        </span>
        <span className="text-[11px] font-medium text-muted-foreground">{getScoreLabel(score)}</span>
      </div>
    </div>
  );
}

function FactorDetail({ factor, onClose }: { factor: HealthFactor; onClose: () => void }) {
  const shouldReduceMotion = useReducedMotion();
  const cfg = statusColor[factor.status];
  const RING_R = 22;
  const RING_C = 2 * Math.PI * RING_R;

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8, scale: 0.96 }}
      animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.96 }}
      transition={shouldReduceMotion ? { duration: 0 } : undefined}
      className="space-y-3"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className={cn("flex size-9 items-center justify-center rounded-xl", cfg.bg, cfg.text)}>
            {factorIcons[factor.id]}
          </div>
          <div>
            <p className="text-sm font-semibold">{factor.label}</p>
            <Badge variant="outline" className={cn("text-[10px]", cfg.text)}>
              {factor.status}
            </Badge>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close factor details"
          className="rounded-full p-1 hover:bg-muted"
        >
          <XIcon className="size-3.5 text-muted-foreground" />
        </button>
      </div>
      <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
        <svg width="54" height="54" viewBox="0 0 54 54" className="shrink-0">
          <circle cx="27" cy="27" r={RING_R} fill="none" stroke="var(--color-muted)" strokeWidth="5" opacity={0.3} />
          <motion.circle
            cx="27"
            cy="27"
            r={RING_R}
            fill="none"
            stroke={cfg.fill}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={RING_C}
            initial={{ strokeDashoffset: RING_C }}
            animate={{ strokeDashoffset: RING_C - (factor.score / 100) * RING_C }}
            transition={shouldReduceMotion ? { duration: 0 } : undefined}
            transform="rotate(-90 27 27)"
          />
          <text
            x="27"
            y="27"
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-foreground text-[11px] font-bold tabular-nums"
          >
            {factor.score}
          </text>
        </svg>
        <p className="text-xs leading-relaxed text-muted-foreground">{factor.description}</p>
      </div>
    </motion.div>
  );
}

export function HealthScore() {
  const { health } = useDashboardData();
  const [selectedFactor, setSelectedFactor] = useState<HealthFactor | null>(null);

  if (health.insufficientData) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <HeartPulseIcon className="size-4 text-primary" />
            Financial health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <p className="text-sm font-medium text-muted-foreground">Insufficient data</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Add accounts and transactions to track your financial health metrics.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <HeartPulseIcon className="size-4 text-primary" />
          Financial health
        </CardTitle>
        <CardAction>
          <div
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
              health.trend === "up"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
            )}
          >
            {health.trend === "up" ? <TrendingUpIcon className="size-3" /> : <TrendingDownIcon className="size-3" />}
            {health.trendDelta >= 0 ? "+" : ""}
            {health.trendDelta} pts
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-4">
          <ScoreGauge score={health.overall} />
          <div className="w-full">
            <AnimatePresence mode="wait">
              {selectedFactor ? (
                <FactorDetail
                  key={selectedFactor.id}
                  factor={selectedFactor}
                  onClose={() => setSelectedFactor(null)}
                />
              ) : (
                <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1">
                  {health.factors.map((factor, i) => {
                    const cfg = statusColor[factor.status];
                    return (
                      <motion.button
                        key={factor.id}
                        type="button"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 + i * 0.06 }}
                        onClick={() => setSelectedFactor(factor)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/50"
                      >
                        <div className={cn("flex size-6 shrink-0 items-center justify-center rounded-md", cfg.bg, cfg.text)}>
                          {factorIcons[factor.id]}
                        </div>
                        <span className="flex-1 truncate text-xs font-medium">{factor.label}</span>
                        <span className="w-6 text-right text-[11px] font-semibold tabular-nums">{factor.score}</span>
                        <ChevronRightIcon className="size-3 text-muted-foreground" />
                      </motion.button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
