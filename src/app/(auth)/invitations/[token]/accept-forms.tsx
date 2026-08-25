"use client";

import { useActionState } from "react";
import { acceptInvitationAction } from "@/app/(auth)/invitations/[token]/actions";
import { Field, FormError, Input } from "@/components/ds/form";
import { SubmitButton } from "@/components/ds/submit-button";

export function AcceptExistingForm({ token }: { token: string }) {
  const [state, action] = useActionState(acceptInvitationAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <FormError message={state?.ok === false ? state.error : undefined} />
      <SubmitButton className="w-full">Join this family</SubmitButton>
    </form>
  );
}

export function AcceptNewAccountForm({ token, email }: { token: string; email: string }) {
  const [state, action] = useActionState(acceptInvitationAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <FormError message={state?.ok === false ? state.error : undefined} />
      <Field label="Your name" htmlFor="name">
        <Input id="name" name="name" required maxLength={120} autoComplete="name" />
      </Field>
      <Field label="Email" htmlFor="emailDisplay">
        <Input id="emailDisplay" type="email" defaultValue={email} disabled />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 10 characters with a letter and a digit.">
        <Input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" />
      </Field>
      <SubmitButton className="w-full">Create account and join</SubmitButton>
    </form>
  );
}
