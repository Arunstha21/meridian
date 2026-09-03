"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createTransactionAction, createTransferAction } from "../../actions";
import { Card, Alert } from "@/components/ds/card";
import { Field, FormError, Input, Select, Textarea } from "@/components/ds/form";
import { SubmitButton } from "@/components/ds/submit-button";
import { TagPicker } from "@/components/ds/tag-picker";

export type Option = { id: string; name: string };
type AccountOption = Option & { currency: string };

export function NewTransactionForms({
  accounts,
  categories,
  tags
}: {
  accounts: AccountOption[];
  categories: Option[];
  tags: Option[];
}) {
  const params = useSearchParams();
  const preset = params.get("account") ?? "";
  const [mode, setMode] = useState<"expense" | "income" | "transfer">("expense");
  const active = accounts.filter((a) => a.currency);
  const canTransfer = active.length >= 2;
  const modes = canTransfer
    ? (["expense", "income", "transfer"] as const)
    : (["expense", "income"] as const);

  return (
    <>
      <div
        role="tablist"
        aria-label="Transaction type"
        className="flex max-w-fit gap-1 rounded-lg bg-surface-inset p-1"
      >
        {modes.map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-md px-4 py-2 text-sm font-medium capitalize transition-colors ${
              mode === m ? "bg-surface text-primary shadow-sm" : "text-muted hover:bg-surface-hover"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {active.length === 0 ? (
        <Alert title="Add an account first">
          You need one account to record transactions and two to move money between them.
        </Alert>
      ) : mode === "transfer" && canTransfer ? (
        <TransferForm accounts={active} presetAccount={preset} />
      ) : (
        <EntryForm mode={mode === "transfer" ? "expense" : mode} accounts={active} categories={categories} tags={tags} presetAccount={preset} />
      )}
    </>
  );
}

function EntryForm({
  mode,
  accounts,
  categories,
  tags,
  presetAccount
}: {
  mode: "expense" | "income";
  accounts: AccountOption[];
  categories: Option[];
  tags: Option[];
  presetAccount: string;
}) {
  const [state, action] = useActionState(createTransactionAction, undefined);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Card>
      <form action={action} className="grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="kind" value={mode} />
        <FormError message={state?.ok === false ? state.error : undefined} />
        <Field label="Account" htmlFor="accountId">
          <Select id="accountId" name="accountId" defaultValue={presetAccount || accounts[0]?.id}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date" htmlFor="date">
          <Input id="date" name="date" type="date" defaultValue={today} required />
        </Field>
        <Field label="Amount" htmlFor="amount">
          <Input id="amount" name="amount" inputMode="decimal" placeholder="0.00" required />
        </Field>
        <Field label="Description" htmlFor="name">
          <Input
            id="name"
            name="name"
            required
            maxLength={240}
            placeholder={mode === "expense" ? "Grocery run" : "Salary"}
          />
        </Field>
        <Field label="Category" htmlFor="categoryId">
          <Select id="categoryId" name="categoryId" defaultValue="">
            <option value="">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Merchant (optional)" htmlFor="merchant">
          <Input id="merchant" name="merchant" maxLength={120} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes (optional)" htmlFor="notes">
            <Textarea id="notes" name="notes" maxLength={5000} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <TagPicker tags={tags} />
        </div>
        <div className="sm:col-span-2">
          <SubmitButton>Record {mode}</SubmitButton>
        </div>
      </form>
    </Card>
  );
}

function TransferForm({
  accounts,
  presetAccount
}: {
  accounts: AccountOption[];
  presetAccount: string;
}) {
  const [state, action] = useActionState(createTransferAction, undefined);
  const today = new Date().toISOString().slice(0, 10);
  const sameCurrency = accounts.filter(
    (a) =>
      !presetAccount ||
      a.currency === accounts.find((x) => x.id === presetAccount)?.currency ||
      a.id !== presetAccount
  );
  void sameCurrency;
  return (
    <Card>
      <form action={action} className="grid gap-4 sm:grid-cols-2">
        <FormError message={state?.ok === false ? state.error : undefined} />
        <Field label="From account" htmlFor="fromAccountId">
          <Select
            id="fromAccountId"
            name="fromAccountId"
            defaultValue={presetAccount || accounts[0]?.id}
            required
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="To account"
          htmlFor="toAccountId"
          hint="Accounts must share the same currency."
        >
          <Select id="toAccountId" name="toAccountId" defaultValue={accounts[1]?.id ?? ""} required>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date" htmlFor="t-date">
          <Input id="t-date" name="date" type="date" defaultValue={today} required />
        </Field>
        <Field label="Amount" htmlFor="t-amount">
          <Input id="t-amount" name="amount" inputMode="decimal" placeholder="0.00" required />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Note (optional)" htmlFor="t-name">
            <Input
              id="t-name"
              name="name"
              maxLength={240}
              placeholder="Monthly credit card payment"
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <SubmitButton>Move money</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
