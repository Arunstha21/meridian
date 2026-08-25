import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-md space-y-6 py-10">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-fg">M</span>
            Meridian
          </Link>
          <p className="mt-1 text-sm text-muted">Know exactly where you stand.</p>
        </div>
        {children}
      </div>
    </main>
  );
}
