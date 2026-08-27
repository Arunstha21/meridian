"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signInAction } from "../actions";
import { Field, FormError, Input } from "@/components/ds/form";
import { SubmitButton } from "@/components/ds/submit-button";

export function SignInForm() {
  const [state, action] = useActionState(signInAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <FormError message={state?.ok === false ? state.error : undefined} />
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>
      <SubmitButton className="w-full">Sign in</SubmitButton>
      <div className="flex justify-center text-sm">
        <Link href="/forgot-password" className="text-primary underline-offset-4 hover:underline">
          Forgot password?
        </Link>
      </div>
    </form>
  );
}
