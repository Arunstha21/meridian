"use client";

import { useActionState } from "react";
import { manageCategoryAction, deleteCategoryAction } from "@/app/(app)/settings/actions-organize";
import { Card } from "@/components/ds/card";
import { Field, FormError, Input, Select } from "@/components/ds/form";
import { SubmitButton } from "@/components/ds/submit-button";
import { ConfirmDialog } from "@/components/ds/dialog";

type Category = { id: string; name: string; color: string | null; parentId: string | null };

export function CategoryManager({
  categories,
  currency
}: {
  categories: Category[];
  currency: string;
}) {
  void currency;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h2 className="mb-3 text-base font-medium text-primary">Add a category</h2>
        <CreateForm categories={categories.filter((c) => !c.parentId)} />
      </Card>
      <Card>
        <h2 className="mb-3 text-base font-medium text-primary">Existing categories</h2>
        {categories.length === 0 ? (
          <p className="text-sm text-muted">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span>
                  {c.parentId ? <span className="mr-2 text-muted">↳</span> : null}
                  {c.name}
                </span>
                <DeleteButton categoryId={c.id} categoryName={c.name} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function CreateForm({ categories }: { categories: Category[] }) {
  const [state, action] = useActionState(manageCategoryAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="op" value="create" />
      <FormError message={state?.ok === false ? state.error : undefined} />
      <Field label="Name" htmlFor="cat-name">
        <Input id="cat-name" name="name" required maxLength={80} placeholder="Groceries" />
      </Field>
      <Field label="Parent (optional)" htmlFor="cat-parent">
        <Select id="cat-parent" name="parentId" defaultValue="">
          <option value="">Top level</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <SubmitButton>Create category</SubmitButton>
    </form>
  );
}

function DeleteButton({ categoryId, categoryName }: { categoryId: string; categoryName?: string }) {
  return (
    <ConfirmDialog
      trigger={<span className="inline-flex rounded-lg px-3.5 py-2 text-sm font-medium hover:bg-surface-inset-hover">Delete</span>}
      title={`Delete ${categoryName ?? "this category"}?`}
      description="Transactions keep their amounts; this category is removed from them."
      confirmLabel="Delete category"
      action={deleteCategoryAction}
    >
      <input type="hidden" name="id" value={categoryId} />
    </ConfirmDialog>
  );
}
