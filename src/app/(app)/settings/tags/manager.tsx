"use client";

import { useActionState } from "react";
import { manageTagAction, deleteTagAction } from "@/app/(app)/settings/actions-organize";
import { Card } from "@/components/ds/card";
import { Field, FormError, Input } from "@/components/ds/form";
import { SubmitButton } from "@/components/ds/submit-button";

type Tag = { id: string; name: string; color: string | null };

export function TagManager({ tags }: { tags: Tag[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h2 className="mb-3 text-sm font-medium text-muted">Add a tag</h2>
        <CreateForm />
      </Card>
      <Card>
        <h2 className="mb-3 text-sm font-medium text-muted">Existing tags</h2>
        {tags.length === 0 ? (
          <p className="text-sm text-muted">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {tags.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span>#{t.name}</span>
                <form action={deleteTagAction}>
                  <input type="hidden" name="id" value={t.id} />
                  <SubmitButton variant="ghost">Delete</SubmitButton>
                </form>
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
