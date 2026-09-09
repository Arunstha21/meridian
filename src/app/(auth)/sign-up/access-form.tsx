"use client";

import { useActionState } from "react";
import { Field, FormError, Input } from "@/components/ds/form";
import { SubmitButton } from "@/components/ds/submit-button";
import { createAccessHouseholdAction } from "./access-action";

export function AccessHouseholdForm({ email }: { email: string }) {
  const [state, action] = useActionState(createAccessHouseholdAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-muted-foreground">Signed in as {email}</p>
      <FormError message={state && !state.ok ? state.error : undefined} />
      <Field label="Your name" htmlFor="name">
        <Input id="name" name="name" autoComplete="name" required maxLength={120} />
      </Field>
      <Field label="Household name" htmlFor="familyName">
        <Input id="familyName" name="familyName" required maxLength={120} />
      </Field>
      <Field label="Currency" htmlFor="currency">
        <Input
          id="currency"
          name="currency"
          defaultValue="NPR"
          required
          minLength={3}
          maxLength={3}
        />
      </Field>
      <Field label="Time zone" htmlFor="timezone">
        <Input id="timezone" name="timezone" defaultValue="Asia/Kathmandu" required />
      </Field>
      <SubmitButton className="w-full">Create household</SubmitButton>
    </form>
  );
}
