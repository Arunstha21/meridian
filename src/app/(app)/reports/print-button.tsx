"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-accent"
    >
      Print
    </button>
  );
}
