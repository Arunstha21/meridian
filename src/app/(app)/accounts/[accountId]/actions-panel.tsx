"use client";

import { useActionState } from "react";
import { Dialog } from "@/components/ds/dialog";
import { Field, FormError, Input, Select } from "@/components/ds/form";
import { SubmitButton } from "@/components/ds/submit-button";
import { updateAccountAction, setAccountStatusAction, deleteAccountAction, shareAccountAction } from "@/app/(app)/accounts/actions";

type Member = { id: string; name: string; email: string };

export function AccountActions({
  accountId,
  status,
  accountName,
  members
}: {
  accountId: string;
  status: string;
  accountName: string;
  members: Member[];
}) {
  return (
    <>
      <Dialog trigger={<span className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium">Edit</span>} title="Account settings">
        <EditSettings accountId={accountId} />
      </Dialog>

      <Dialog trigger={<span className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium">Share</span>} title="Share with family members">
        <SharePanel accountId={accountId} members={members} />
      </Dialog>

      <form action={setAccountStatusAction}>
        <input type="hidden" name="accountId" value={accountId} />
        <input type="hidden" name="status" value={status === "active" ? "disabled" : "active"} />
        <SubmitButton variant="secondary">{status === "active" ? "Close account" : "Reopen account"}</SubmitButton>
      </form>

      <Dialog
        trigger={
          <span className="rounded-lg border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive">
            Delete
          </span>
        }
        title="Delete this account?"
        description="This permanently removes the account and every transaction in it. This cannot be undone."
      >
        {(close) => <DeleteForm accountId={accountId} accountName={accountName} close={close} />}
      </Dialog>
    </>
  );
}

function EditSettings({ accountId }: { accountId: string }) {
  const [state, action] = useActionState(updateAccountAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="accountId" value={accountId} />
      <FormError message={state?.ok === false ? state.error : undefined} />
      <Field label="Name" htmlFor="edit-name">
        <Input id="edit-name" name="name" required maxLength={120} />
      </Field>
      <Field label="Institution" htmlFor="edit-institution">
        <Input id="edit-institution" name="institution" maxLength={120} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="includedInReports" value="on" defaultChecked className="h-4 w-4" />
        Include in reports
      </label>
      <SubmitButton>Save changes</SubmitButton>
    </form>
  );
}

function SharePanel({ accountId, members }: { accountId: string; members: Member[] }) {
  const [state, action] = useActionState(shareAccountAction, undefined);
  const others = members.filter((m) => m.email);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="accountId" value={accountId} />
      <FormError message={state?.ok === false ? state.error : undefined} />
      {others.length === 0 ? (
        <p className="text-sm text-muted">
          Invite family members first (Settings → Members), then share this account with them here.
        </p>
      ) : (
        <>
          <Field label="Family member" htmlFor="share-user">
            <Select id="share-user" name="userId" required>
              {others.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.email})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Permission" htmlFor="permission">
            <Select id="permission" name="permission" defaultValue="read_only">
              <option value="read_only">View only</option>
              <option value="read_write">Can edit details (not amounts)</option>
              <option value="full_control">Full control</option>
            </Select>
          </Field>
          <div className="flex gap-2">
            <SubmitButton name="op" value="share">Grant / update</SubmitButton>
            <SubmitButton name="op" value="unshare" variant="secondary">Remove access</SubmitButton>
          </div>
        </>
      )}
    </form>
  );
}

function DeleteForm({ accountId, accountName, close }: { accountId: string; accountName: string; close: () => void }) {
  const [state, action] = useActionState(deleteAccountAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="accountId" value={accountId} />
      <FormError message={state?.ok === false ? state.error : undefined} />
      <p className="text-sm text-muted">
        Type <strong>{accountName}</strong> to confirm.
      </p>
      <Input name="confirmName" aria-label="Confirmation text" required autoComplete="off" />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={close} className="rounded-lg px-3 py-2 text-sm">
          Cancel
        </button>
        <SubmitButton variant="destructive" type="submit">
          Delete forever
        </SubmitButton>
      </div>
    </form>
  );
}
