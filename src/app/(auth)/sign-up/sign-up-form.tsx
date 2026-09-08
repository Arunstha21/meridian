"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUpAction } from "../actions";
import { Field, FormError, Input, Select } from "@/components/ds/form";
import { SubmitButton } from "@/components/ds/submit-button";

const SIGNUP_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "INR", "NPR", "SGD", "JPY"];
const SIGNUP_TIMEZONES = [
  "Etc/UTC",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Asia/Singapore",
  "Australia/Sydney"
];

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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Reporting currency" htmlFor="currency">
          <Select id="currency" name="currency" defaultValue="USD">
            {SIGNUP_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Time zone" htmlFor="timezone">
          <Select id="timezone" name="timezone" defaultValue="Etc/UTC">
            {SIGNUP_TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </Select>
        </Field>
      </div>
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
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
