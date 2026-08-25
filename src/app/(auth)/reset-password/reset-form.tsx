"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resetPasswordAction } from "../actions";
import { Field, FormError, Input } from "@/components/ds/form";
import { SubmitButton } from "@/components/ds/submit-button";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <FormError message={state?.ok === false ? state.error : undefined} />
      <Field label="New password" htmlFor="password" hint="At least 10 characters with a letter and a digit.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirmPassword">
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
      </Field>
      <SubmitButton className="w-full">Reset password</SubmitButton>
    </form>
  );
}

export function InvalidToken() {
  return (
    <div className="space-y-3">
      <p className="text-sm">This reset link is invalid or has expired.</p>
      <Link href="/forgot-password" className="text-sm text-primary underline-offset-4 hover:underline">
        Request a new link
      </Link>
    </div>
  );
}
