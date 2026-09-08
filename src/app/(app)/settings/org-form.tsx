"use client";

import { useActionState } from "react";
import { updateFamilySettingsAction } from "@/app/(app)/settings/actions";
import { Field, FormError, Input, Select } from "@/components/ds/form";
import { SubmitButton } from "@/components/ds/submit-button";

export function OrgForm({
  familyName,
  currency,
  locale
}: {
  familyName: string;
  currency: string;
  locale: string;
}) {
  const [state, action] = useActionState(updateFamilySettingsAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <FormError message={state?.ok === false ? state.error : undefined} />
      <Field label="Family name" htmlFor="org-name">
        <Input id="org-name" name="name" defaultValue={familyName} maxLength={120} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Reporting currency"
          htmlFor="org-currency"
          hint="Reports convert into this currency."
        >
          <Select id="org-currency" name="currency" defaultValue={currency}>
            {[
              "USD",
              "EUR",
              "GBP",
              "CAD",
              "AUD",
              "NZD",
              "JPY",
              "CHF",
              "SEK",
              "NOK",
              "DKK",
              "INR",
              "NPR",
              "SGD"
            ].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Language" htmlFor="org-locale" hint="English only in this release.">
          <Select id="org-locale" name="locale" defaultValue={locale}>
            <option value="en">English</option>
          </Select>
        </Field>
      </div>
      <SubmitButton>Save organization</SubmitButton>
    </form>
  );
}
