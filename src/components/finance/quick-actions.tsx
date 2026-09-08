"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeftRightIcon, MessageCircleIcon, PlusIcon, WalletIcon } from "lucide-react";

const actions = [
  { href: "/quick-add", label: "Quick add", hint: "Capture a transaction fast", icon: PlusIcon },
  { href: "/transactions/new", label: "Ledger entry", hint: "Income, expense, or transfer", icon: ArrowLeftRightIcon },
  { href: "/accounts/new", label: "New account", hint: "Cash, credit, or other asset", icon: WalletIcon },
  { href: "/chat", label: "Ask assistant", hint: "Review spending in plain language", icon: MessageCircleIcon }
];

export function QuickActions() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Quick actions</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {actions.map((action) => (
          <Button
            key={action.href}
            variant="outline"
            className="h-auto justify-start gap-3 px-3 py-2.5"
            render={<Link href={action.href} />}
          >
            <action.icon className="size-4 text-muted-foreground" />
            <span className="min-w-0 text-left">
              <span className="block text-sm font-medium">{action.label}</span>
              <span className="block text-[11px] font-normal text-muted-foreground">{action.hint}</span>
            </span>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
