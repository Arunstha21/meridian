"use client";

export default function GlobalError({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="text-center space-y-4">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-muted-foreground">The error has been logged. You can try again.</p>
        <button
          onClick={reset}
          className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
