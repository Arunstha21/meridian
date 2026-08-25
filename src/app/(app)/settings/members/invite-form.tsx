"use client";

import { useActionState, useState } from "react";
import { createInvitationAction } from "@/app/(app)/settings/actions";
import { Card } from "@/components/ds/card";
import { Field, FormError, FormSuccess, Input, Select } from "@/components/ds/form";
import { SubmitButton } from "@/components/ds/submit-button";

export function InviteForm() {
  const [state, action] = useActionState(createInvitationAction, undefined);
  const [copied, setCopied] = useState(false);
  const inviteUrl = state?.ok && state.data ? state.data.inviteUrl : null;

  return (
    <Card>
      <h2 className="mb-3 text-sm font-medium text-muted">Invite a member</h2>
      <form action={action} className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <Field label="Email" htmlFor="invite-email">
          <Input id="invite-email" name="email" type="email" required placeholder="partner@example.com" />
        </Field>
        <Field label="Role" htmlFor="invite-role">
          <Select id="invite-role" name="role" defaultValue="member">
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </Select>
        </Field>
        <div className="flex items-end pb-0.5">
          <SubmitButton>Send invite</SubmitButton>
        </div>
      </form>
      {state?.ok === false ? (
        <FormError message={state.error} />
      ) : null}
      {inviteUrl ? (
        <FormSuccess
          message={
            copied
              ? "Invite link copied to clipboard."
              : "Invitation created. Email delivery is queued; you can also share this link directly."
          }
        />
      ) : null}
      {inviteUrl ? (
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(inviteUrl).then(() => setCopied(true));
          }}
          className="mt-2 max-w-full truncate rounded-lg border border-border px-3 py-2 text-left text-xs text-primary"
        >
          {inviteUrl}
        </button>
      ) : null}
    </Card>
  );
}
