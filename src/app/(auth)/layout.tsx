"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showAuthSwitch = pathname === "/sign-in" || pathname === "/sign-up";
  const signingIn = pathname === "/sign-in";

  return (
    <main className="flex min-h-screen flex-col overflow-y-auto bg-bg px-6 py-12">
      <div className="flex flex-1 flex-col justify-center">
        <div className="w-full max-w-md sm:mx-auto">
          <div className="flex justify-center">
            <Link
              href="/"
              className="grid h-16 w-16 place-items-center rounded-2xl bg-primary text-xl font-semibold text-primary-fg"
              aria-label="Meridian home"
            >
              M
            </Link>
          </div>
          {showAuthSwitch ? (
            <nav className="mt-6 flex rounded-lg bg-surface-inset p-1" aria-label="Authentication">
              <Link
                href="/sign-in"
                aria-current={signingIn ? "page" : undefined}
                className={`w-1/2 rounded-md px-2 py-1.5 text-center text-sm font-medium ${
                  signingIn ? "bg-surface text-primary shadow-sm" : "text-muted"
                }`}
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                aria-current={!signingIn ? "page" : undefined}
                className={`w-1/2 rounded-md px-2 py-1.5 text-center text-sm font-medium ${
                  !signingIn ? "bg-surface text-primary shadow-sm" : "text-muted"
                }`}
              >
                Create account
              </Link>
            </nav>
          ) : null}
        </div>
        <div className="mt-8 w-full max-w-lg sm:mx-auto">{children}</div>
      </div>
      <footer className="pt-8 text-center text-xs text-muted">Self-hosted personal finance</footer>
    </main>
  );
}
