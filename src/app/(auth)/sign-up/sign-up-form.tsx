"use client";

import { useActionState } from "react";
import { signUpAction } from "../actions";
import { Field, FormError, Input } from "@/components/ds/form";
import { SubmitButton } from "@/components/ds/submit-button";

export function SignUpForm() {
  const [state, action] = useActionState(signUpAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <FormError message={state?.ok === false ? state.error : undefined} />
      <Field label="Your name" htmlFor="name">
        <Input id="name" name="name" autoComplete="name" required maxLength={120} />
      </Field>
      <Field
        label="Family name"
        htmlFor="familyName"
        hint="You can invite partners or family members later."
      >
        <Input
          id="familyName"
          name="familyName"
          required
          maxLength={120}
          placeholder="e.g. The Shresthas"
        />
      </Field>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        hint="At least 10 characters with a letter and a digit."
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
        />
      </Field>
      <SubmitButton className="w-full">Create your account</SubmitButton>
    </form>
  );
}
