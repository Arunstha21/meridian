"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  PieChart,
  CreditCard,
  ChartBar,
  MessageCircle,
  Settings,
  EyeOff,
  Eye,
  LogOut,
  Plus,
  PanelLeft,
  PanelRight,
  X
} from "lucide-react";
import { fmtMoney } from "@/lib/format";

export type NavAccount = {
  id: string;
  name: string;
  type: string;
  displayBalanceMinor: number;
  currency: string;
};

const NAV_ICONS = {
  "/": PieChart,
  "/transactions": CreditCard,
  "/budgets": ChartBar,
  "/reports": ChartBar,
  "/chat": MessageCircle,
  "/settings": Settings
} as const;

function UserMenu({
  user,
  family,
  showAdmin,
  signOut,
  mobile = false
}: {
  user: string;
  family: string;
  showAdmin: boolean;
  signOut: () => Promise<void>;
  mobile?: boolean;
}) {
  return (
    <details className="relative">
      <summary
        className={`flex cursor-pointer list-none items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-inset-hover hover:text-primary ${
          mobile ? "h-9 w-9" : "h-9 w-9"
        }`}
        aria-label="Open account menu"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-[11px] font-medium text-primary-fg">
          {user
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0])
            .join("")
            .toUpperCase() || "M"}
        </span>
      </summary>
      <div
        className={`absolute z-50 mt-2 w-56 rounded-xl border border-border bg-surface p-1 shadow-lg ${
          mobile ? "right-0" : "bottom-0 left-full ml-2 mt-0"
        }`}
      >
        <div className="border-b border-border px-3 py-2">
          <p className="truncate text-sm font-medium text-primary">{user}</p>
          <p className="truncate text-xs text-muted">{family}</p>
        </div>
        <Link
          href="/quick-add"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-inset-hover"
        >
          <Plus className="h-4 w-4 text-muted" />
          Quick add
        </Link>
        <Link
          href="/settings"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-inset-hover"
        >
          <Settings className="h-4 w-4 text-muted" />
          Settings
        </Link>
        {showAdmin ? (
          <Link
            href="/admin"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface-inset-hover"
          >
            <Settings className="h-4 w-4 text-muted" />
            Admin
          </Link>
        ) : null}
        <div className="my-1 border-t border-border" />
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-inset-hover"
          >
            <LogOut className="h-4 w-4 text-muted" />
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}

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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [accountFilter, setAccountFilter] = useState<"all" | "assets" | "liabilities">("all");

  const navItems = [
    { href: "/", label: "Dashboard", exact: true },
    { href: "/transactions", label: "Transactions", exact: false },
    { href: "/budgets", label: "Budgets", exact: false },
    { href: "/reports", label: "Reports", exact: false },
    { href: "/chat", label: "Assistant", exact: false },
    { href: "/settings", label: "Settings", exact: false }
  ];

  const desktopNavItems = navItems.slice(0, 5);
  const mobileNavItems = desktopNavItems;

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  const currentSectionLabel = pathname.startsWith("/accounts")
    ? "Accounts"
    : pathname.startsWith("/quick-add")
      ? "Quick add"
      : (navItems.find((item) => isActive(item.href, item.exact))?.label ?? "Meridian");

  const AccountRow = ({ a }: { a: NavAccount }) => (
    <Link
      href={`/accounts/${a.id}`}
      onClick={() => setMobileOpen(false)}
      className="group flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-surface-inset-hover"
    >
      <span className="min-w-0 truncate text-primary">{a.name}</span>
      <span className="tabular shrink-0 text-xs text-muted">
        {privacy ? "•••••" : fmtMoney(a.displayBalanceMinor, a.currency)}
      </span>
    </Link>
  );

  const visibleAssets = accountFilter === "liabilities" ? [] : assets;
  const visibleLiabilities = accountFilter === "assets" ? [] : liabilities;

  const accountSidebar = (
    <nav aria-label="Accounts" className="flex h-full flex-col gap-4 overflow-y-auto">
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-muted">{family}</p>
        <button
          type="button"
          className="hidden rounded-md p-1 text-muted transition-colors hover:bg-surface-inset-hover lg:block"
          onClick={() => setSidebarOpen(false)}
          aria-label="Collapse accounts sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
      </div>

      <div className="rounded-xl border border-border bg-surface px-3 py-2.5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Net worth</p>
        <p className="tabular mt-1 text-lg font-semibold">
          {privacy ? "••••••" : fmtMoney(netWorthMinor, currency)}
        </p>
      </div>

      <div
        className="grid grid-cols-3 gap-0.5 rounded-lg bg-surface-inset p-1"
        role="tablist"
        aria-label="Account type"
      >
        {[
          ["all", "All"],
          ["assets", "Assets"],
          ["liabilities", "Debts"]
        ].map(([value, label]) => {
          const selected = accountFilter === value;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setAccountFilter(value as "all" | "assets" | "liabilities")}
              className={`rounded-md px-1 py-1.5 text-xs font-medium transition-colors ${
                selected ? "bg-surface text-primary shadow-sm" : "text-muted hover:bg-surface-hover"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <Link
        href="/accounts/new"
        onClick={() => setMobileOpen(false)}
        className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted transition-colors hover:bg-surface-inset-hover hover:text-primary"
      >
        <Plus className="h-4 w-4" />
        Add account
      </Link>

      {visibleAssets.length > 0 ? (
        <section>
          <h2 className="mb-1 px-2 text-xs font-medium text-muted">Assets</h2>
          <div className="space-y-0.5">
            {visibleAssets.map((a) => (
              <AccountRow key={a.id} a={a} />
            ))}
          </div>
        </section>
      ) : null}

      {visibleLiabilities.length > 0 ? (
        <section>
          <h2 className="mb-1 px-2 text-xs font-medium text-muted">Debts</h2>
          <div className="space-y-0.5">
            {visibleLiabilities.map((a) => (
              <AccountRow key={a.id} a={a} />
            ))}
          </div>
        </section>
      ) : null}

      {visibleAssets.length === 0 && visibleLiabilities.length === 0 ? (
        <p className="px-2 py-4 text-sm text-muted">No accounts in this view.</p>
      ) : null}
    </nav>
  );

  const assistantSidebar = (
    <aside className="hidden w-80 shrink-0 border-l border-border lg:block">
      <div className="sticky top-0 flex h-dvh flex-col p-4">
        <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <p className="text-sm font-medium">Assistant</p>
            <p className="text-xs text-muted">Your financial copilot</p>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-inset-hover hover:text-primary"
            onClick={() => setAssistantOpen(false)}
            aria-label="Close assistant sidebar"
          >
            <PanelRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-1 flex-col justify-center text-center">
          <MessageCircle className="mx-auto h-7 w-7 text-muted" />
          <p className="mt-3 text-sm font-medium">Ask Meridian about your money</p>
          <p className="mt-1 text-sm text-muted">
            Review recent activity, spending, and your account balances.
          </p>
          <Link
            href="/chat"
            className="mt-4 self-center rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg"
          >
            Open assistant
          </Link>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-bg lg:h-dvh lg:overflow-hidden">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      <div className="hidden border-r border-border lg:block">
        <nav aria-label="Primary" className="flex h-full w-[84px] flex-col items-center py-4">
          <Link
            href="/"
            className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-fg"
            aria-label="Meridian dashboard"
          >
            M
          </Link>
          <Link
            href="/quick-add"
            title="Quick add"
            className="group relative mb-2 block rounded-lg focus-ring"
          >
            <span className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors group-hover:bg-surface-hover group-hover:text-primary">
              <Plus className="h-4 w-4" />
            </span>
            <span className="mt-1 block text-center text-[11px] font-medium text-muted">
              Quick add
            </span>
          </Link>
          {desktopNavItems.map((item) => {
            const Icon = NAV_ICONS[item.href as keyof typeof NAV_ICONS];
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href, item.exact) ? "page" : undefined}
                title={item.label}
                className="group relative mb-1 block rounded-lg focus-ring"
              >
                <span
                  className={`absolute left-0 top-3 h-4 w-1 rounded-r-sm ${isActive(item.href, item.exact) ? "bg-primary" : ""}`}
                />
                <span
                  className={`mx-auto flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                    isActive(item.href, item.exact)
                      ? "bg-surface text-primary shadow-sm"
                      : "text-muted group-hover:bg-surface-hover group-hover:text-primary"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span
                  className={`mt-1 block text-center text-[11px] font-medium ${isActive(item.href, item.exact) ? "text-primary" : "text-muted"}`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
          <div className="mt-auto flex flex-col items-center gap-1">
            {!sidebarOpen ? (
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-primary"
                onClick={() => setSidebarOpen(true)}
                aria-label="Show sidebar"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
            ) : null}
            <form action={togglePrivacy}>
              <button
                type="submit"
                aria-pressed={privacy}
                title="Privacy mode hides all monetary amounts"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-primary"
              >
                {privacy ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                <span className="sr-only">Toggle privacy mode</span>
              </button>
            </form>
            <Link
              href="/settings"
              aria-current={isActive("/settings", false) ? "page" : undefined}
              title="Settings"
              className="group relative block rounded-lg focus-ring"
            >
              <span
                className={`absolute left-0 top-3 h-4 w-1 rounded-r-sm ${isActive("/settings", false) ? "bg-primary" : ""}`}
              />
              <span
                className={`mx-auto flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                  isActive("/settings", false)
                    ? "bg-surface text-primary shadow-sm"
                    : "text-muted group-hover:bg-surface-hover group-hover:text-primary"
                }`}
              >
                <Settings className="h-4 w-4" />
              </span>
              <span
                className={`mt-1 block text-center text-[11px] font-medium ${isActive("/settings", false) ? "text-primary" : "text-muted"}`}
              >
                Settings
              </span>
            </Link>
            <UserMenu user={user} family={family} showAdmin={showAdmin} signOut={signOut} />
          </div>
        </nav>
      </div>

      {sidebarOpen ? (
        <aside className="hidden w-72 shrink-0 border-r border-border py-4 pr-3 pl-4 2xl:w-80 lg:block">
          <div className="sticky top-0 h-dvh">{accountSidebar}</div>
        </aside>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-bg/95 px-3 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-hover hover:text-primary"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
            <span className="sr-only">Menu</span>
          </button>
          <Link
            href="/"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-fg"
            aria-label="Meridian dashboard"
          >
            M
          </Link>
          <div className="flex items-center gap-1">
            <form action={togglePrivacy}>
              <button
                type="submit"
                aria-pressed={privacy}
                className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-hover hover:text-primary"
                aria-label="Toggle privacy mode"
              >
                {privacy ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </form>
            <UserMenu user={user} family={family} showAdmin={showAdmin} signOut={signOut} mobile />
          </div>
        </header>

        {mobileOpen ? (
          <aside
            id="mobile-nav"
            className="fixed inset-x-0 bottom-0 top-[57px] z-20 overflow-y-auto bg-bg px-4 py-4 lg:hidden"
          >
            {accountSidebar}
          </aside>
        ) : null}

        <main id="main" className="min-w-0 flex-1 overflow-y-auto">
          <div className="sticky top-0 z-10 hidden items-center justify-between gap-2 border-b border-border bg-bg px-10 py-4 lg:flex">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-hover hover:text-primary"
                onClick={() => setSidebarOpen((open) => !open)}
                aria-label={sidebarOpen ? "Hide accounts sidebar" : "Show accounts sidebar"}
              >
                <PanelLeft className="h-4 w-4" />
              </button>
              <p className="text-sm text-muted">{currentSectionLabel}</p>
            </div>
            <div className="flex items-center gap-1">
              <form action={togglePrivacy}>
                <button
                  type="submit"
                  aria-pressed={privacy}
                  title="Privacy mode hides all monetary amounts"
                  className="rounded-lg p-2 text-muted transition-colors hover:bg-surface-hover hover:text-primary"
                >
                  {privacy ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  <span className="sr-only">Toggle privacy mode</span>
                </button>
              </form>
              <button
                type="button"
                className={`rounded-lg p-2 transition-colors ${assistantOpen ? "bg-surface-inset text-primary" : "text-muted hover:bg-surface-hover hover:text-primary"}`}
                onClick={() => setAssistantOpen((open) => !open)}
                aria-pressed={assistantOpen}
                aria-label="Toggle assistant sidebar"
              >
                <PanelRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="w-full space-y-6 px-3 py-4 pb-24 sm:px-6 lg:px-10 lg:py-6 lg:pb-12">
            {children}
          </div>
        </main>
      </div>

      {assistantOpen ? assistantSidebar : null}

      <nav
        className="no-print fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-border bg-bg pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Primary"
      >
        {mobileNavItems.map((item) => {
          const Icon = NAV_ICONS[item.href as keyof typeof NAV_ICONS];
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={() => setMobileOpen(false)}
              className="relative flex min-w-14 flex-col items-center gap-1 px-2 pb-2 pt-2 text-[11px] font-medium"
            >
              <span
                className={`absolute top-0 h-1 w-4 rounded-b-sm ${active ? "bg-primary" : ""}`}
              />
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${active ? "bg-surface text-primary shadow-sm" : "text-muted"}`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className={active ? "text-primary" : "text-muted"}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
