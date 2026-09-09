"use client";

import { useMemo, useState } from "react";
import { fmtMoney } from "@/lib/format";

export type ChartPoint = { date: string; valueMinor: number };

const WIDTH = 720;
const HEIGHT = 220;
const PAD = { top: 12, right: 8, bottom: 22, left: 8 };

function formatDay(iso: string): string {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`)
  );
}

/**
 * Interactive net worth line chart: hover (or touch) crosshair with a tooltip
 * showing the exact value at that date. Pure SVG, no chart library.
 */
export function NetWorthChart({
  points,
  currency,
  masked
}: {
  points: ChartPoint[];
  currency: string;
  masked: boolean;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const geometry = useMemo(() => {
    if (points.length < 2) return null;
    const values = points.map((p) => p.valueMinor);
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    const span = max - min || 1;
    const innerW = WIDTH - PAD.left - PAD.right;
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    const stepX = innerW / (points.length - 1);
    const coords = points.map((p, i) => ({
      x: PAD.left + i * stepX,
      y: PAD.top + innerH - ((p.valueMinor - min) / span) * innerH,
      point: p
    }));
    const line = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
    const area = `${PAD.left},${HEIGHT - PAD.bottom} ${line} ${WIDTH - PAD.right},${HEIGHT - PAD.bottom}`;
    const zeroY = PAD.top + innerH - ((0 - min) / span) * innerH;
    return { coords, line, area, zeroY };
  }, [points]);

  if (!geometry || masked) {
    return (
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-56 w-full"
        role="img"
        aria-label="No trend data"
      >
        <line
          x1={0}
          y1={HEIGHT / 2}
          x2={WIDTH}
          y2={HEIGHT / 2}
          stroke="var(--border)"
          strokeWidth="1"
        />
      </svg>
    );
  }

  const first = points[0]!;
  const last = points[points.length - 1]!;
  const hovered = hoverIndex !== null ? geometry.coords[hoverIndex] : null;

  const handleMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * WIDTH;
    let closest = 0;
    let bestDist = Infinity;
    for (let i = 0; i < geometry.coords.length; i++) {
      const d = Math.abs(geometry.coords[i]!.x - x);
      if (d < bestDist) {
        bestDist = d;
        closest = i;
      }
    }
    setHoverIndex(closest);
  };

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-56 w-full touch-pan-y"
        role="img"
        aria-label="Net worth trend chart"
        onPointerMove={handleMove}
        onPointerDown={handleMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        <line
          x1={0}
          y1={geometry.zeroY}
          x2={WIDTH}
          y2={geometry.zeroY}
          stroke="var(--border)"
          strokeDasharray="3 3"
        />
        <polygon points={geometry.area} fill="var(--primary)" opacity="0.08" />
        <polyline
          points={geometry.line}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <text x={PAD.left} y={HEIGHT - 6} className="fill-current text-[10px] text-muted-foreground">
          {formatDay(first.date)}
        </text>
        <text
          x={WIDTH - PAD.right}
          y={HEIGHT - 6}
          textAnchor="end"
          className="fill-current text-[10px] text-muted-foreground"
        >
          {formatDay(last.date)}
        </text>
        {hovered ? (
          <g>
            <line
              x1={hovered.x}
              y1={PAD.top}
              x2={hovered.x}
              y2={HEIGHT - PAD.bottom}
              stroke="var(--muted)"
              strokeWidth="1"
            />
            <circle
              cx={hovered.x}
              cy={hovered.y}
              r="4"
              fill="var(--primary)"
              stroke="var(--surface)"
              strokeWidth="2"
            />
          </g>
        ) : null}
      </svg>
      {hovered ? (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-md border border-border bg-surface px-2 py-1 text-xs shadow-sm"
          style={{
            left: `${(hovered.x / WIDTH) * 100}%`,
            top: 0
          }}
        >
          <span className="block text-muted-foreground">{formatDay(hovered.point.date)}</span>
          <span className="tabular font-medium">
            {fmtMoney(hovered.point.valueMinor, currency)}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function RangePicker({ value, basePath }: { value: string; basePath: string }) {
  const ranges = [
    { key: "90", label: "3M" },
    { key: "180", label: "6M" },
    { key: "365", label: "1Y" },
    { key: "all", label: "All" }
  ];
  return (
    <div className="flex gap-1" role="group" aria-label="Chart range">
      {ranges.map((r) => (
        <a
          key={r.key}
          href={`${basePath}?nw=${r.key}`}
          aria-current={value === r.key ? "true" : undefined}
          className={`rounded-md px-2 py-1 text-xs font-medium ${
            value === r.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-border/50 hover:text-foreground"
          }`}
        >
          {r.label}
        </a>
      ))}
    </div>
  );
}
