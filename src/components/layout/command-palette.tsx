"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from "@/components/ui/command";
import {
  LayoutDashboardIcon,
  WalletIcon,
  ArrowLeftRightIcon,
  PlusIcon,
  ChartAreaIcon,
  TargetIcon,
  MessageCircleIcon,
  SettingsIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  SearchIcon
} from "lucide-react";
import { applyTheme } from "@/lib/theme";
import { setThemePreferenceAction } from "@/server/actions/session-actions";
import { fmtMoney } from "@/lib/format";
import type { NavAccount } from "@/components/layout/app-sidebar";

const pages = [
  { label: "Overview", icon: LayoutDashboardIcon, href: "/" },
  { label: "Accounts", icon: WalletIcon, href: "/accounts" },
  { label: "Transactions", icon: ArrowLeftRightIcon, href: "/transactions" },
  { label: "New transaction", icon: PlusIcon, href: "/transactions/new" },
  { label: "Quick add", icon: PlusIcon, href: "/quick-add" },
  { label: "Reports", icon: ChartAreaIcon, href: "/reports" },
  { label: "Budgets", icon: TargetIcon, href: "/budgets" },
  { label: "Assistant", icon: MessageCircleIcon, href: "/chat" },
  { label: "Settings", icon: SettingsIcon, href: "/settings" }
];

export function CommandPalette({
  accounts,
  privacy
}: {
  accounts: NavAccount[];
  privacy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const run = useCallback((fn: () => void) => {
    setOpen(false);
    fn();
  }, []);

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command Palette"
      description="Search pages and accounts"
    >
      <Command>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Pages">
            {pages.map((page) => (
              <CommandItem key={page.href} onSelect={() => run(() => router.push(page.href))}>
                <page.icon className="mr-2 size-4" />
                {page.label}
              </CommandItem>
            ))}
          </CommandGroup>
          {accounts.length > 0 ? (
            <>
              <CommandSeparator />
              <CommandGroup heading="Accounts">
                {accounts.slice(0, 12).map((account) => (
                  <CommandItem
                    key={account.id}
                    onSelect={() => run(() => router.push(`/accounts/${account.id}`))}
                  >
                    <SearchIcon className="mr-2 size-4" />
                    {account.name}
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                      {privacy ? "•••••" : fmtMoney(account.displayBalanceMinor, account.currency)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          ) : null}
          <CommandSeparator />
          <CommandGroup heading="Theme">
            <CommandItem
              onSelect={() =>
                run(() => {
                  applyTheme("light");
                  void setThemePreferenceAction("light");
                })
              }
            >
              <SunIcon className="mr-2 size-4" />
              Light mode
            </CommandItem>
            <CommandItem
              onSelect={() =>
                run(() => {
                  applyTheme("dark");
                  void setThemePreferenceAction("dark");
                })
              }
            >
              <MoonIcon className="mr-2 size-4" />
              Dark mode
            </CommandItem>
            <CommandItem
              onSelect={() =>
                run(() => {
                  applyTheme("system");
                  void setThemePreferenceAction("system");
                })
              }
            >
              <MonitorIcon className="mr-2 size-4" />
              System theme
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
