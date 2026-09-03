import { fmtMoney } from "@/lib/format";

export function Amount({
  minor,
  currency,
  masked = false,
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
  if (masked) {
    return <span className={`tabular ${className}`}>•••••</span>;
  }
  const value = signed && minor > 0 ? `+${fmtMoney(minor, currency)}` : fmtMoney(minor, currency);
  const tone = amountTone(minor, colorize);
  return (
    <span className={`tabular ${tone} ${className}`.trim()}>
      {value}
    </span>
  );
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
  masked = false
}: {
  points: { date: string; valueMinor: number }[];
  width?: number;
  height?: number;
  masked?: boolean;
}) {
  if (points.length < 2 || masked) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="h-28 w-full" role="img" aria-label="No trend data">
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="var(--border)" strokeWidth="1" />
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
    const y = height - ((p.valueMinor - min) / span) * (height - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const zeroY = height - ((0 - min) / span) * (height - 8) - 4;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-28 w-full" role="img" aria-label="Net worth trend">
      <line x1="0" y1={zeroY} x2={width} y2={zeroY} stroke="var(--border)" strokeDasharray="3 3" />
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BarRow({
  label,
  value,
  total,
  formatted,
  color = "var(--primary)"
}: {
  label: string;
  value: number;
  total: number;
  formatted: string;
  color?: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="truncate">{label}</span>
        <span className="tabular text-muted">{formatted}</span>
      </div>
      <div className="h-2 rounded-full bg-border/60">
        <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
