"use client";

import { useActionState, useState } from "react";
import {
  updateTransactionAction,
  splitEntryAction,
  linkTransferAction,
  deleteEntryAction,
  unsplitEntryAction,
  unlinkTransferAction
} from "@/app/(app)/actions";
import { Card, Alert } from "@/components/ds/card";
import { Field, FormError, Input, Select, Textarea } from "@/components/ds/form";
import { SubmitButton } from "@/components/ds/submit-button";
import { Dialog, useDialogClose } from "@/components/ds/dialog";

export type DetailProps = {
  entry: {
    id: string;
    date: string;
    name: string;
    notes: string | null;
    amountMinor: number;
    currency: string;
  };
  level: "full_control" | "read_write" | "read_only";
  categories: { id: string; name: string }[];
  categoryId: string | null;
  merchant: string | null;
  transferId: string | null;
  transferPartnerName?: string;
  splits: { id: string; name: string; amountMinor: number }[];
  suggestions: {
    entryId: string;
    date: string;
    name: string;
    amountMinor: number;
    accountName: string;
  }[];
};

function displayAmount(minor: number): string {
  const abs = Math.abs(minor);
  return (abs / 100).toFixed(2);
}

export function TransactionDetailClient(p: DetailProps) {
  const isExpense = p.entry.amountMinor > 0;
  const canCore = p.level === "full_control";
  const [updateState, updateAction] = useActionState(updateTransactionAction, undefined);
  const [linkState, linkAction] = useActionState(linkTransferAction, undefined);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <form action={updateAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="entryId" value={p.entry.id} />
          <input type="hidden" name="ledgerSign" value={isExpense ? "1" : "-1"} />
          <FormError message={updateState?.ok === false ? updateState.error : undefined} />

          <Field label="Description" htmlFor="d-name">
            <Input
              id="d-name"
              name="name"
              defaultValue={p.entry.name}
              required
              maxLength={240}
              disabled={!canCore}
            />
          </Field>
          <Field label="Date" htmlFor="d-date">
            <Input
              id="d-date"
              name="date"
              type="date"
              defaultValue={p.entry.date}
              disabled={!canCore}
            />
          </Field>
          <Field
            label={`Amount (${p.entry.currency})`}
            htmlFor="d-amount"
            hint={canCore ? undefined : "Your access level cannot change amounts."}
          >
            <Input
              id="d-amount"
              name="amount"
              inputMode="decimal"
              defaultValue={displayAmount(p.entry.amountMinor)}
              disabled={!canCore}
            />
          </Field>
          <Field label="Category" htmlFor="d-category">
            <Select id="d-category" name="categoryId" defaultValue={p.categoryId ?? ""}>
              <option value="">Uncategorized</option>
              {p.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Merchant" htmlFor="d-merchant">
            <Input
              id="d-merchant"
              name="merchant"
              defaultValue={p.merchant ?? ""}
              maxLength={120}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes" htmlFor="d-notes">
              <Textarea
                id="d-notes"
                name="notes"
                defaultValue={p.entry.notes ?? ""}
                maxLength={5000}
              />
            </Field>
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <SubmitButton>Save changes</SubmitButton>
            {!canCore && p.level === "read_write" ? (
              <span className="text-xs text-muted">
                You can edit category, merchant and notes only.
              </span>
            ) : null}
          </div>
        </form>
      </Card>

      <div className="space-y-6">
        <Card>
          <h2 className="mb-2 text-base font-medium text-primary">Transfer</h2>
          {p.transferId ? (
            <>
              <p className="text-sm">
                Linked with <strong>{p.transferPartnerName}</strong>.
              </p>
              <form action={unlinkTransferAction} className="mt-3">
                <input type="hidden" name="transferId" value={p.transferId} />
                <input type="hidden" name="entryId" value={p.entry.id} />
                <SubmitButton variant="secondary">Unlink transfer</SubmitButton>
              </form>
            </>
          ) : (
            <SuggestTransfer
              entryId={p.entry.id}
              suggestions={p.suggestions}
              linkState={linkState?.ok === false ? linkState.error : undefined}
              linkAction={linkAction}
            />
          )}
        </Card>

        <Card>
          <h2 className="mb-2 text-base font-medium text-primary">Split</h2>
          {p.splits.length > 0 ? (
            <>
              <ul className="divide-y divide-border text-sm">
                {p.splits.map((c) => (
                  <li key={c.id} className="flex justify-between py-2">
                    <span>{c.name}</span>
                    <span className="tabular">{displayAmount(c.amountMinor)}</span>
                  </li>
                ))}
              </ul>
              <form action={unsplitEntryAction} className="mt-3">
                <input type="hidden" name="parentEntryId" value={p.entry.id} />
                <SubmitButton variant="secondary">Remove split</SubmitButton>
              </form>
            </>
          ) : canCore && !p.transferId ? (
            <Dialog
              trigger={
                <span className="rounded-lg border border-border px-3 py-2 text-sm font-medium">
                  Split this transaction
                </span>
              }
              title="Split into parts"
            >
              <SplitForm parentEntryId={p.entry.id} totalMinor={p.entry.amountMinor} />
            </Dialog>
          ) : (
            <p className="text-sm text-muted">
              {p.transferId
                ? "Unlink the transfer before splitting."
                : "Only full-control access can split."}
            </p>
          )}
        </Card>

        <Card>
          <h2 className="mb-2 text-base font-medium text-destructive">Danger zone</h2>
          <form action={deleteEntryAction}>
            <input type="hidden" name="entryId" value={p.entry.id} />
            <SubmitButton variant="destructive" disabled={p.level !== "full_control"}>
              Delete transaction
            </SubmitButton>
          </form>
        </Card>
      </div>
    </div>
  );
}

function SuggestTransfer({
  entryId,
  suggestions,
  linkState,
  linkAction
}: {
  entryId: string;
  suggestions: DetailProps["suggestions"];
  linkState?: string;
  linkAction: (fd: FormData) => void;
}) {
  return (
    <div className="space-y-3">
      {linkState ? <Alert title={linkState} tone="destructive" /> : null}
      <p className="text-sm text-muted">
        Found a matching opposite-side transaction? Link them as one transfer.
      </p>
      {suggestions.length === 0 ? (
        <p className="text-sm text-muted">No nearby candidates within ±4 days.</p>
      ) : (
        <ul className="divide-y divide-border">
          {suggestions.slice(0, 5).map((s) => (
            <li key={s.entryId} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="min-w-0 truncate">
                {s.name}
                <span className="block text-xs text-muted">{s.accountName}</span>
              </span>
              <form action={linkAction} className="shrink-0">
                <input type="hidden" name="outflowEntryId" value={entryId} />
                <input type="hidden" name="inflowEntryId" value={s.entryId} />
                <SubmitButton variant="secondary">Link</SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SplitForm({
  parentEntryId,
  totalMinor
}: {
  parentEntryId: string;
  totalMinor: number;
}) {
  const close = useDialogClose();
  const [state, action] = useActionState(splitEntryAction, undefined);
  const [rows, setRows] = useState([0, 0]);

  const parts = rows.map((v) => Math.round(v));
  const sum = parts.reduce((a, b) => a + b, 0);
  const remaining = totalMinor - sum;

  return (
    <form action={action} className="space-y-4">
      <input
        type="hidden"
        name="payload"
        value={JSON.stringify({
          parentEntryId,
          parts: parts.map((amountLedgerMinor) => ({ amountLedgerMinor }))
        })}
      />
      <FormError message={state?.ok === false ? state.error : undefined} />
      <p className="text-sm text-muted">
        Parts must add up to the full original amount. Remaining:{" "}
        <strong className="tabular">{(remaining / 100).toFixed(2)}</strong>
      </p>
      {rows.map((_, i) => (
        <Field key={i} label={`Part ${i + 1}`} htmlFor={`part-${i}`}>
          <Input
            id={`part-${i}`}
            type="number"
            step="0.01"
            inputMode="decimal"
            required
            onChange={(e) => {
              const v = Number(e.target.value);
              setRows((prev) => prev.map((old, idx) => (idx === i ? Math.round(v * 100) : old)));
            }}
          />
        </Field>
      ))}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => setRows((r) => [...r, 0])}
          className="text-sm text-primary hover:underline"
        >
          + Add part
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={close} className="px-3 py-2 text-sm">
            Cancel
          </button>
          <SubmitButton disabled={remaining !== 0}>Create split</SubmitButton>
        </div>
      </div>
    </form>
  );
}
