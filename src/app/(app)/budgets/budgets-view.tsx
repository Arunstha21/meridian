"use client";

import { useActionState } from "react";
import { setBudgetAction, removeBudgetAction } from "./actions";
import { Card, Badge } from "@/components/ds/card";
import { Field, FormError, Input } from "@/components/ds/form";
import { SubmitButton } from "@/components/ds/submit-button";
import { fmtMoney } from "@/lib/format";

export type Progress = {
  categoryId: string | null;
  categoryName: string;
  limitMinor: number;
  spentMinor: number;
  remainingMinor: number;
  pct: number;
};

function pctTone(pct: number): "success" | "warning" | "destructive" {
  if (pct >= 1) return "destructive";
  if (pct >= 0.8) return "warning";
  return "success";
}

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(pct, 1.5);
  const width = Math.min(clamped / 1.5, 1) * 100;
  const tone = pctTone(pct);
  const color =
    tone === "destructive" ? "bg-destructive" : tone === "warning" ? "bg-warning" : "bg-success";
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-border/60"
      role="progressbar"
      aria-valuenow={Math.round(pct * 100)}
      aria-valuemin={0}
      aria-valuemax={150}
    >
      <div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
    </div>
  );
}

export function BudgetsView({
  currency,
  overall,
  perCategory,
  categoriesWithoutBudget,
  monthLabel
}: {
  currency: string;
  overall: Progress | null;
  perCategory: Progress[];
  categoriesWithoutBudget: { id: string; name: string }[];
  monthLabel: string;
}) {
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-medium text-primary">Overall monthly cap — {monthLabel}</h2>
          {overall ? (
            <Badge tone={pctTone(overall.pct)}>{Math.round(overall.pct * 100)}% used</Badge>
          ) : null}
        </div>
        {overall ? (
          <div className="mt-3 space-y-2">
            <div className="flex items-baseline justify-between text-sm">
              <span className="tabular font-medium">
                {fmtMoney(overall.spentMinor, currency)} spent
              </span>
              <span className="tabular text-muted">
                of {fmtMoney(overall.limitMinor, currency)}
              </span>
            </div>
            <ProgressBar pct={overall.pct} />
            <p className="text-xs text-muted">
              {overall.remainingMinor >= 0
                ? `${fmtMoney(overall.remainingMinor, currency)} left this month`
                : `${fmtMoney(-overall.remainingMinor, currency)} over cap`}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">No overall cap set.</p>
        )}
        <div className="mt-4 border-t border-border pt-4">
          <OverallCapForm current={overall?.limitMinor ?? null} currency={currency} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <h2 className="mb-3 text-base font-medium text-primary">Category budgets</h2>
          {perCategory.length === 0 ? (
            <p className="text-sm text-muted">No category budgets yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {perCategory.map((b) => (
                <li key={b.categoryId ?? "overall"} className="space-y-2 py-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2 font-medium">
                      <span className="truncate">{b.categoryName}</span>
                      <Badge tone={pctTone(b.pct)}>{Math.round(b.pct * 100)}%</Badge>
                    </span>
                    <span className="tabular shrink-0 text-muted">
                      {fmtMoney(b.spentMinor, currency)} / {fmtMoney(b.limitMinor, currency)}
                    </span>
                  </div>
                  <ProgressBar pct={b.pct} />
                  <form action={removeBudgetAction}>
                    <input type="hidden" name="categoryId" value={b.categoryId ?? ""} />
                    <SubmitButton variant="ghost">Remove budget</SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden">
          <h2 className="mb-3 text-base font-medium text-primary">Set a category budget</h2>
          <SetBudgetForm categories={categoriesWithoutBudget} currency={currency} />
        </Card>
      </div>
    </div>
  );
}

function OverallCapForm({ current, currency }: { current: number | null; currency: string }) {
  const [state, action] = useActionState(setBudgetAction, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="categoryId" value="" />
      <FormError message={state?.ok === false ? state.error : undefined} />
      <Field label={`Overall monthly cap (${currency})`} htmlFor="overall-amount">
        <Input
          id="overall-amount"
          name="amount"
          inputMode="decimal"
          placeholder="5000.00"
          defaultValue={current !== null ? (current / 100).toFixed(2) : ""}
        />
      </Field>
      <SubmitButton>{current !== null ? "Update cap" : "Set cap"}</SubmitButton>
      {current !== null ? <span className="text-xs text-muted">Applies every month.</span> : null}
    </form>
  );
}

function SetBudgetForm({
  categories,
  currency
}: {
  categories: { id: string; name: string }[];
  currency: string;
}) {
  const [state, action] = useActionState(setBudgetAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <FormError message={state?.ok === false ? state.error : undefined} />
      <p className="text-xs text-muted">
        Only unbudgeted categories are listed. Remove a budget above to change it.
      </p>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Category</span>
        <select
          name="categoryId"
          required
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-sm outline-none transition-[border-color,box-shadow] focus:border-primary focus:ring-4 focus:ring-primary/10"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <Field label={`Monthly limit (${currency})`} htmlFor="budget-amount">
        <Input id="budget-amount" name="amount" required inputMode="decimal" placeholder="800.00" />
      </Field>
      <SubmitButton>Set budget</SubmitButton>
    </form>
  );
}
