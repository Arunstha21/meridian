"use client";

import { useActionState } from "react";
import { deleteFamilyAction } from "@/app/(app)/settings/actions";
import { FormError, Input } from "@/components/ds/form";
import { SubmitButton } from "@/components/ds/submit-button";

export function DeleteFamilyForm({ familyName }: { familyName: string }) {
  const [state, action] = useActionState(deleteFamilyAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <FormError message={state?.ok === false ? state.error : undefined} />
      <p className="text-sm text-muted-foreground">
        Type <strong>{familyName}</strong> to confirm deletion.
      </p>
      <Input name="confirmName" aria-label="Confirmation text" required autoComplete="off" />
      <SubmitButton variant="destructive">Delete this family forever</SubmitButton>
    </form>
  );
}
