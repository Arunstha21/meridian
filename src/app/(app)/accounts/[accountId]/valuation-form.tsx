"use client";

import { useActionState } from "react";
import { recordValuationAction } from "@/app/(app)/actions";
import { Card } from "@/components/ds/card";
import { Field, FormError, Input, Select } from "@/components/ds/form";
import { SubmitButton } from "@/components/ds/submit-button";

export function ValuationForm({ accountId, currency }: { accountId: string; currency: string }) {
  const [state, action] = useActionState(recordValuationAction, undefined);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card id="valuation">
      <h2 className="mb-3 text-base font-medium text-primary">Update valuation</h2>
      <form action={action} className="grid gap-4 sm:grid-cols-3">
        <input type="hidden" name="accountId" value={accountId} />
        <FormError message={state?.ok === false ? state.error : undefined} />
        <Field label="Date" htmlFor="val-date">
          <Input id="val-date" name="date" type="date" defaultValue={today} required />
        </Field>
        <Field label={`Value (${currency})`} htmlFor="val-amount">
          <Input id="val-amount" name="amount" inputMode="decimal" placeholder="0.00" required />
        </Field>
        <Field label="Kind" htmlFor="val-kind">
          <Select id="val-kind" name="kind" defaultValue="current">
            <option value="current">Current value</option>
            <option value="reconciliation">Reconciliation</option>
          </Select>
        </Field>
        <div className="sm:col-span-3">
          {state?.ok ? <p className="mb-3 text-sm text-success">Valuation saved.</p> : null}
          <SubmitButton>Record valuation</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
