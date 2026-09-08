import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10",
        className
      )}
      {...props}
    />
  );
}

const badgeTones = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  primary: "bg-primary/10 text-primary"
};

export function Badge({
  tone = "neutral",
  children
}: {
  tone?: keyof typeof badgeTones;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeTones[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  hint,
  action
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card p-10 text-center">
      <p className="font-medium">{title}</p>
      {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      {action}
    </div>
  );
}

export function Alert({
  tone = "warning",
  title,
  children
}: {
  tone?: "warning" | "destructive";
  title: string;
  children?: React.ReactNode;
}) {
  const cls =
    tone === "destructive"
      ? "border-destructive/30 bg-destructive-bg text-destructive"
      : "border-warning/30 bg-warning/10 text-warning";
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${cls}`} role="status">
      <p className="font-medium">{title}</p>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 pb-1">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle ? <p className="text-sm text-muted-foreground sm:text-base">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2 no-print">{actions}</div> : null}
    </header>
  );
}
