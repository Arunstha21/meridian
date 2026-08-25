import type { ComponentProps } from "react";

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`rounded-xl border border-border bg-surface p-5 ${className}`} {...props} />;
}

const badgeTones = {
  neutral: "bg-border/60 text-muted",
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
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeTones[tone]}`}>
      {children}
    </span>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-10 text-center">
      <p className="font-medium">{title}</p>
      {hint ? <p className="text-sm text-muted">{hint}</p> : null}
      {action}
    </div>
  );
}

export function Alert({ tone = "warning", title, children }: { tone?: "warning" | "destructive"; title: string; children?: React.ReactNode }) {
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

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 pb-1">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2 no-print">{actions}</div> : null}
    </div>
  );
}
