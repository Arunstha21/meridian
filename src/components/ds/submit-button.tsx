"use client";

import { useFormStatus } from "react-dom";
import type { ComponentProps } from "react";

export function SubmitButton({
  children,
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "ghost" | "destructive" | "link" }) {
  const { pending } = useFormStatus();
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50 px-3.5 py-2 min-h-9";
  const variants: Record<string, string> = {
    primary: "bg-primary text-primary-fg hover:opacity-90",
    secondary: "border border-border bg-surface hover:bg-border/40",
    ghost: "hover:bg-border/60",
    destructive: "bg-destructive text-white hover:opacity-90",
    link: "text-primary underline underline-offset-4"
  };
  return (
    <button
      type="submit"
      aria-busy={pending}
      disabled={pending || props.disabled}
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    >
      {pending ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function Spinner() {
  return (
    <span
      aria-hidden
      className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}
