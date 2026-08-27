"use client";

import { useActionState } from "react";
import { importSureExportAction } from "./actions";
import { FormError } from "@/components/ds/form";
import { SubmitButton } from "@/components/ds/submit-button";

export function SureImportForm() {
  const [state, action] = useActionState(importSureExportAction, undefined);
  const skipped = state?.ok ? Object.entries(state.data?.skipped ?? {}) : [];
  return (
    <form action={action} className="space-y-3">
      <FormError message={state?.ok === false ? state.error : undefined} />
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted">Sure export file</span>
        <input
          name="sureExport"
          type="file"
          accept=".zip,.ndjson,application/zip,application/x-ndjson,application/json"
          required
          className="block w-full cursor-pointer rounded-lg border border-border bg-surface px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-surface-inset file:px-2 file:py-1 file:text-sm file:font-medium hover:file:bg-surface-hover"
        />
      </label>
      <p className="text-xs text-muted">
        Export your family from Sure, then upload its ZIP (Meridian reads <code>all.ndjson</code>)
        or the extracted file. The family must be empty so the migration cannot merge or overwrite
        data.
      </p>
      <SubmitButton>Import from Sure</SubmitButton>
      {state?.ok && state.data ? (
        <div
          className="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success"
          role="status"
        >
          Imported {state.data.accounts} accounts, {state.data.transactions} transactions, and{" "}
          {state.data.transfers} transfers.
          {skipped.length ? (
            <p className="mt-1 text-xs text-muted">
              Not migrated: {skipped.map(([type, count]) => `${count} ${type}`).join(", ")}.
              Meridian records the core ledger, not Sure-only rules, merchants, attachment metadata,
              or generic investment history.
            </p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
