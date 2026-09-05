export default function AppLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-border/70" />
      <div className="grid gap-6 sm:grid-cols-3">
        <div className="min-h-[280px] animate-pulse rounded-xl border border-border bg-surface sm:col-span-2" />
        <div className="min-h-[280px] animate-pulse rounded-xl border border-border bg-surface" />
      </div>
      <div className="min-h-[180px] animate-pulse rounded-xl border border-border bg-surface" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
