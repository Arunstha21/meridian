"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LandmarkIcon } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const splitAuth = pathname === "/sign-in" || pathname === "/sign-up";

  if (splitAuth) return <>{children}</>;

  return (
    <main className="flex min-h-screen flex-col overflow-y-auto bg-background px-6 py-12">
      <div className="flex flex-1 flex-col justify-center">
        <div className="w-full max-w-md sm:mx-auto">
          <div className="flex justify-center">
            <Link
              href="/"
              className="grid h-16 w-16 place-items-center rounded-2xl bg-primary text-primary-foreground"
              aria-label="Meridian home"
            >
              <LandmarkIcon className="size-7" />
            </Link>
          </div>
        </div>
        <div className="mt-8 w-full max-w-lg sm:mx-auto">{children}</div>
      </div>
      <footer className="pt-8 text-center text-xs text-muted-foreground">Self-hosted personal finance</footer>
    </main>
  );
}
