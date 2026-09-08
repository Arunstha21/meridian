"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { LandmarkIcon, ShieldCheckIcon } from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number]
    }
  }
};

export function AuthShell({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-zinc-950 lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_55%)]" />
        <div className="pointer-events-none absolute -right-24 top-24 size-80 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -bottom-16 left-10 size-64 rounded-full border border-white/10" />
        <Link href="/" className="relative z-20 flex items-center gap-2.5 p-8">
          <div className="flex size-8 items-center justify-center rounded-lg bg-white text-black">
            <LandmarkIcon className="size-4" />
          </div>
          <span className="text-sm font-semibold text-white">Meridian</span>
        </Link>
        <div className="relative z-20 space-y-6 px-8">
          <p className="max-w-sm text-2xl font-medium tracking-tight text-white">
            Know exactly where you stand.
          </p>
          <ul className="space-y-2 text-sm text-white/70">
            <li>Family-scoped ledger with transfers and splits</li>
            <li>Server-owned balances, budgets, and reports</li>
            <li>Self-hosted. Your data stays yours.</li>
          </ul>
        </div>
        <div className="relative z-20 mt-auto p-8">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <blockquote className="text-sm leading-relaxed text-white/80">
              &ldquo;The best time to start tracking was yesterday. The second best time is now.&rdquo;
            </blockquote>
            <p className="mt-3 text-xs text-white/50">&mdash; Meridian</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-background px-6 py-12">
        <motion.div
          className="w-full max-w-sm"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div className="mb-8 flex flex-col items-center lg:hidden" variants={itemVariants}>
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <LandmarkIcon className="size-5" />
            </div>
          </motion.div>
          <motion.div className="text-center" variants={itemVariants}>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
          </motion.div>
          <motion.div className="mt-8" variants={itemVariants}>
            {children}
          </motion.div>
          <motion.div
            className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted-foreground/60"
            variants={itemVariants}
          >
            <ShieldCheckIcon className="size-3.5" />
            <span>Self-hosted personal finance</span>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
