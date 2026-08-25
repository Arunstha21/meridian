"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { fmtMoney } from "@/lib/format";

export type NavAccount = {
  id: string;
  name: string;
  type: string;
  displayBalanceMinor: number;
  currency: string;
};

export function Shell({
  user,
  family,
  privacy,
  assets,
  liabilities,
  netWorthMinor,
  currency,
  children,
  signOut,
  togglePrivacy,
  showAdmin
}: {
  user: string;
  family: string;
  privacy: boolean;
  assets: NavAccount[];
  liabilities: NavAccount[];
  netWorthMinor: number;
  currency: string;
  children: React.ReactNode;
  signOut: () => Promise<void>;
  togglePrivacy: () => Promise<void>;
  showAdmin: boolean;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Dashboard", exact: true },
    { href: "/transactions", label: "Transactions", exact: false },
    { href: "/reports", label: "Reports", exact: false },
    { href: "/settings", label: "Settings", exact: false }
  ];

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  const AccountRow = ({ a }: { a: NavAccount }) => (
    <Link
      href={`/accounts/${a.id}`}
      className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-border/50"
    >
      <span className="truncate">{a.name}</span>
      <span className="tabular text-xs text-muted">{privacy ? "•••••" : fmtMoney(a.displayBalanceMinor, a.currency)}</span>
    </Link>
  );

  const sidebar = (
    <nav aria-label="Primary" className="flex h-full flex-col gap-6 overflow-y-auto p-4">
      <div className="px-2">
        <p className="text-sm font-semibold">Meridian</p>
        <p className="text-xs text-muted">{family}</p>
      </div>

      <div className="space-y-0.5">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            aria-current={isActive(item.href, item.exact) ? "page" : undefined}
            className={`block rounded-md px-2 py-1.5 text-sm ${
              isActive(item.href, item.exact)
                ? "bg-primary/10 font-medium text-primary"
                : "hover:bg-border/50"
            }`}
          >
            {item.label}
          </Link>
        ))}
        {showAdmin ? (
          <Link
            href="/admin"
            onClick={() => setMobileOpen(false)}
            className={`block rounded-md px-2 py-1.5 text-sm ${
              isActive("/admin", false) ? "bg-primary/10 font-medium text-primary" : "hover:bg-border/50"
            }`}
          >
            Admin
          </Link>
        ) : null}
      </div>

      <div className="rounded-lg border border-border p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Net worth</p>
        </div>
        <p className="tabular mt-1 text-lg font-semibold">
          {privacy ? "••••••" : fmtMoney(netWorthMinor, currency)}
        </p>
      </div>

      {assets.length > 0 ? (
        <div>
          <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-muted">Assets</p>
          {assets.map((a) => (
            <AccountRow key={a.id} a={a} />
          ))}
        </div>
      ) : null}

      {liabilities.length > 0 ? (
        <div>
          <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-muted">Liabilities</p>
          {liabilities.map((a) => (
            <AccountRow key={a.id} a={a} />
          ))}
        </div>
      ) : null}

      <Link
        href="/accounts/new"
        onClick={() => setMobileOpen(false)}
        className="mt-auto block rounded-lg border border-dashed border-border px-3 py-2 text-center text-sm text-muted hover:border-primary hover:text-primary"
      >
        + Add account
      </Link>
    </nav>
  );

  return (
    <div className="min-h-screen lg:flex">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      <aside className="hidden w-64 shrink-0 border-r border-border bg-surface lg:block">
        <div className="sticky top-0 h-screen">{sidebar}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-surface/95 px-4 py-2.5 backdrop-blur">
          <button
            type="button"
            className="rounded-md border border-border px-2 py-1 text-sm lg:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            onClick={() => setMobileOpen((v) => !v)}
          >
            ☰<span className="sr-only">Menu</span>
          </button>
          <span className="text-sm font-medium lg:hidden">Meridian</span>
          <div className="ml-auto flex items-center gap-2">
            <form action={togglePrivacy}>
              <button
                type="submit"
                aria-pressed={privacy}
                title="Privacy mode hides all monetary amounts"
                className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                  privacy ? "border-primary/40 bg-primary/10 text-primary" : "border-border"
                }`}
              >
                {privacy ? "Privacy on" : "Privacy off"}
              </button>
            </form>
            <span className="hidden text-sm text-muted sm:inline">{user}</span>
            <form action={signOut}>
              <button type="submit" className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium">
                Sign out
              </button>
            </form>
          </div>
        </header>

        {mobileOpen ? (
          <div id="mobile-nav" className="border-b border-border bg-surface lg:hidden">
            {sidebar}
          </div>
        ) : null}

        <main id="main" className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
