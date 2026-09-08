"use client";

import { useActionState } from "react";
import { manageTagAction, deleteTagAction } from "@/app/(app)/settings/actions-organize";
import { Card } from "@/components/ds/card";
import { Field, FormError, Input } from "@/components/ds/form";
import { SubmitButton } from "@/components/ds/submit-button";
import { ConfirmDialog } from "@/components/ds/dialog";

type Tag = { id: string; name: string; color: string | null };

export function TagManager({ tags }: { tags: Tag[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h2 className="mb-3 text-base font-medium text-primary">Add a tag</h2>
        <CreateForm />
      </Card>
      <Card>
        <h2 className="mb-3 text-base font-medium text-primary">Existing tags</h2>
        {tags.length === 0 ? (
          <p className="text-sm text-muted">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {tags.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span>#{t.name}</span>
                <ConfirmDialog
                  trigger={
                    <span className="inline-flex rounded-lg px-3.5 py-2 text-sm font-medium hover:bg-surface-inset-hover">
                      Delete
                    </span>
                  }
                  title={`Delete #${t.name}?`}
                  description="The tag is removed from every transaction that used it."
                  confirmLabel="Delete tag"
                  action={deleteTagAction}
                >
                  <input type="hidden" name="id" value={t.id} />
                </ConfirmDialog>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function CreateForm() {
  const [state, action] = useActionState(manageTagAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="op" value="create" />
      <FormError message={state?.ok === false ? state.error : undefined} />
      <Field label="Name" htmlFor="tag-name">
        <Input id="tag-name" name="name" required maxLength={60} placeholder="reimbursable" />
      </Field>
      <SubmitButton>Create tag</SubmitButton>
    </form>
  );
}
