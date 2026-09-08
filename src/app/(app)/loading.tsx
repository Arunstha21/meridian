import { Skeleton } from "@/components/ui/skeleton";

export default function AppLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="min-h-[280px] rounded-xl sm:col-span-2" />
        <Skeleton className="min-h-[280px] rounded-xl" />
      </div>
      <Skeleton className="min-h-[180px] rounded-xl" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
