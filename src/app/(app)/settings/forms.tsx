"use client";

import { useActionState } from "react";
import {
  updateProfileAction,
  updateFamilySettingsAction,
  changeEmailAction,
  changePasswordAction,
  setPreferenceAction
} from "@/app/(app)/settings/actions";
import { Field, FormError, Input, Select } from "@/components/ds/form";
import { SubmitButton } from "@/components/ds/submit-button";

export function ProfileForms({
  name,
  email,
  timezone,
  timezones,
  privacy
}: {
  name: string;
  email: string;
  timezone: string;
  timezones: string[];
  privacy: boolean;
}) {
  return (
    <div className="space-y-6">
      <NameForm name={name} />
      <PrivacyToggle privacy={privacy} />
      <TimezoneForm timezone={timezone} timezones={timezones} />
      <ChangePasswordForm />
      <ChangeEmailForm currentEmail={email} />
    </div>
  );
}

function NameForm({ name }: { name: string }) {
  const [state, action] = useActionState(updateProfileAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <Field label="Display name" htmlFor="s-name">
        <Input id="s-name" name="name" defaultValue={name} required maxLength={120} />
      </Field>
      <SubmitButton variant="secondary">Save profile</SubmitButton>
      {state?.ok ? <p className="text-xs text-success">Saved.</p> : null}
    </form>
  );
}

function PrivacyToggle({ privacy }: { privacy: boolean }) {
  return (
    <form action={setPreferenceAction} className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
      <input type="hidden" name="key" value="privacy_mode" />
      <input type="hidden" name="value" value={privacy ? "off" : "on"} />
      <div>
        <p className="text-sm font-medium">Privacy mode</p>
        <p className="text-xs text-muted">Hide every monetary amount on screen. Currently {privacy ? "on" : "off"}.</p>
      </div>
      <SubmitButton variant="secondary">{privacy ? "Turn off" : "Turn on"}</SubmitButton>
    </form>
  );
}

function TimezoneForm({ timezone, timezones }: { timezone: string; timezones: string[] }) {
  const [state, action] = useActionState(async (_prev: unknown, formData: FormData) => {
    const fd = new FormData();
    fd.set("key", "theme");
    fd.set("value", String(formData.get("theme") ?? "system"));
    await setPreferenceAction(fd);
    const tz = new FormData();
    tz.set("timezone", String(formData.get("timezone") ?? ""));
    tz.set("locale", String(formData.get("locale") ?? "en"));
    await updateFamilySettingsAction(undefined, tz);
    return undefined;
  }, undefined);
  void state;
  return (
    <form action={action} className="space-y-3">
      <Field label="Time zone" htmlFor="s-tz">
        <Select id="s-tz" name="timezone" defaultValue={timezone}>
          {timezones.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </Select>
      </Field>
      <SubmitButton variant="secondary">Save time zone</SubmitButton>
    </form>
  );
}

function ChangePasswordForm() {
  const [state, action] = useActionState(changePasswordAction, undefined);
  return (
    <form action={action} className="space-y-3 border-t border-border pt-4">
      <h3 className="text-sm font-medium">Change password</h3>
      <FormError message={state?.ok === false ? state.error : undefined} />
      <Field label="Current password" htmlFor="cur-pw">
        <Input id="cur-pw" name="currentPassword" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="New password" htmlFor="new-pw" hint="Other sessions will be signed out.">
        <Input id="new-pw" name="newPassword" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <SubmitButton variant="secondary">Update password</SubmitButton>
    </form>
  );
}

function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const [state, action] = useActionState(changeEmailAction, undefined);
  return (
    <form action={action} className="space-y-3 border-t border-border pt-4">
      <h3 className="text-sm font-medium">Change email</h3>
      <p className="text-xs text-muted">Current: {currentEmail}. You will need to verify the new address.</p>
      <FormError message={state?.ok === false ? state.error : undefined} />
      <Field label="Confirm with current password" htmlFor="email-pw">
        <Input id="email-pw" name="currentPassword" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="New email" htmlFor="new-email">
        <Input id="new-email" name="newEmail" type="email" required />
      </Field>
      <SubmitButton variant="secondary">Request email change</SubmitButton>
    </form>
  );
}
