"use client";

import { useState } from "react";
import { Bookmark, X } from "lucide-react";
import Link from "next/link";
import { saveFilterAction, deleteFilterAction } from "./filter-actions";
import { FormError } from "@/components/ds/form";
import { useActionState } from "react";

export type SavedFilter = { id: string; name: string; params: Record<string, string> };

export function SavedFilterBar({
  filters,
  currentParams
}: {
  filters: SavedFilter[];
  currentParams: Record<string, string>;
}) {
  const [state, action] = useActionState(saveFilterAction, undefined);
  const [naming, setNaming] = useState(false);

  const paramsJson = JSON.stringify(currentParams);
  const hasActiveFilters = Object.keys(currentParams).length > 0;
  const activeParamStr = new URLSearchParams(currentParams).toString();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((f) => {
        const qs = new URLSearchParams(f.params).toString();
        const isCurrent = qs === activeParamStr;
        return (
          <span
            key={f.id}
            className={`group inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors ${
              isCurrent
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            }`}
          >
            <Link href={`/transactions${qs ? `?${qs}` : ""}`} className="font-medium">
              {f.name}
            </Link>
            <form action={deleteFilterAction}>
              <input type="hidden" name="id" value={f.id} />
              <button
                type="submit"
                aria-label={`Delete filter ${f.name}`}
                className="rounded-full p-0.5 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </form>
          </span>
        );
      })}

      {naming ? (
        <form action={action} className="flex items-center gap-1.5">
          <input type="hidden" name="params" value={paramsJson} />
          <input
            name="name"
            required
            maxLength={80}
            autoFocus
            placeholder="Filter name…"
            className="w-40 rounded-full border border-border bg-surface px-3 py-1 text-xs outline-none"
          />
          <button
            type="submit"
            className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-fg"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setNaming(false)}
            className="rounded-full p-1 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </form>
      ) : hasActiveFilters ? (
        <button
          type="button"
          onClick={() => setNaming(true)}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary"
        >
          <Bookmark className="h-3 w-3" />
          Save this filter
        </button>
      ) : null}

      {state?.ok === false && naming ? <FormError message={state.error} /> : null}
    </div>
  );
}
