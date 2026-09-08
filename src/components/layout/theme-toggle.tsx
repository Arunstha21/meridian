"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { applyTheme } from "@/lib/theme";
import { setThemePreferenceAction } from "@/server/actions/session-actions";

const emptySubscribe = () => () => {};
const useIsMounted = () =>
  useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

function ContrastIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
      <path d="M12 3l0 18" />
      <path d="M12 9l4.65 -4.65" />
      <path d="M12 14.3l7.37 -7.37" />
      <path d="M12 19.6l8.85 -8.85" />
    </svg>
  );
}

export function ThemeToggle() {
  const mounted = useIsMounted();

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="size-8 rounded-full">
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8 rounded-full"
      onClick={() => {
        const next = document.documentElement.classList.contains("dark") ? "light" : "dark";
        applyTheme(next);
        void setThemePreferenceAction(next);
      }}
    >
      <ContrastIcon className="size-[18px]" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
