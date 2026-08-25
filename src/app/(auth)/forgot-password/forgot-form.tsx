"use client";

import { useActionState } from "react";
import { forgotPasswordAction } from "../actions";
import { Field, FormError, FormSuccess, Input } from "@/components/ds/form";
import { SubmitButton } from "@/components/ds/submit-button";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <FormError message={state?.ok === false ? state.error : undefined} />
      {state?.ok ? (
        <FormSuccess message="If that email can receive resets, a link is on its way. Check your inbox." />
      ) : (
        <>
          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </Field>
          <SubmitButton className="w-full">Send reset link</SubmitButton>
        </>
      )}
    </form>
  );
}
