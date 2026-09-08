"use client";

import { fmtMoney } from "@/lib/format";
import { usePrivacy } from "@/components/layout/privacy-context";

export function Amount({
  minor,
  currency,
  masked,
  signed = false,
  colorize = false,
  className = ""
}: {
  minor: number;
  currency: string;
  masked?: boolean;
  signed?: boolean;
  colorize?: boolean;
  className?: string;
}) {
  const privacy = usePrivacy();
  const isMasked = masked !== undefined ? masked : privacy;

  if (isMasked) {
    return <span className={`tabular ${className}`.trim()}>•••••</span>;
  }
  const value = signed && minor > 0 ? `+${fmtMoney(minor, currency)}` : fmtMoney(minor, currency);
  const tone = amountTone(minor, colorize);
  return <span className={`tabular ${tone} ${className}`.trim()}>{value}</span>;
}

/** Display amounts are already sign-flipped from the ledger: income is positive. */
export function amountTone(minor: number, colorize: boolean): string {
  if (!colorize) return "";
  if (minor > 0) return "text-income";
  if (minor < 0) return "text-destructive";
  return "";
}

export function Sparkline({
  points,
  width = 560,
  height = 120,
  masked
}: {
  points: { date: string; valueMinor: number }[];
  width?: number;
  height?: number;
  masked?: boolean;
}) {
  const privacy = usePrivacy();
  const isMasked = masked !== undefined ? masked : privacy;

  if (points.length < 2 || isMasked) {
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-28 w-full"
        role="img"
        aria-label="No trend data"
      >
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="var(--border)"
          strokeWidth="1"
        />
      </svg>
    );
  }
  const values = points.map((p) => p.valueMinor);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const span = max - min || 1;
  const stepX = width / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = height - ((p.valueMinor - min) / span) * (height - 16) - 8;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-28 w-full"
      role="img"
      aria-label="Net worth trend line"
    >
      <polyline
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coords.join(" ")}
      />
    </svg>
  );
}
