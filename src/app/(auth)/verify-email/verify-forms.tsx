"use client";

import { useActionState } from "react";
import { verifyEmailAction, resendVerificationAction } from "../actions";
import { FormError, FormSuccess } from "@/components/ds/form";
import { SubmitButton } from "@/components/ds/submit-button";

export function VerifyTokenForm({ token }: { token: string }) {
  const [state, action] = useActionState(verifyEmailAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <FormError message={state?.ok === false ? state.error : undefined} />
      <SubmitButton className="w-full">Verify my email</SubmitButton>
    </form>
  );
}

export function ResendForm({ email }: { email?: string }) {
  const [state, action] = useActionState(async () => resendVerificationAction(), undefined);
  return (
    <form action={action} className="space-y-3">
      <FormError message={state?.ok === false ? state.error : undefined} />
      {state?.ok ? <FormSuccess message="A fresh verification link was sent." /> : null}
      <p className="text-sm text-muted-foreground">
        We sent a verification link to {email ? <strong>{email}</strong> : "your inbox"}.
      </p>
      <SubmitButton variant="secondary">Resend verification email</SubmitButton>
    </form>
  );
}
