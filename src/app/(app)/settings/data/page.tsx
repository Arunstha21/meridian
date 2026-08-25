import { requireVerifiedActor, currentFamily } from "@/server/auth/context";
import { Card, PageHeader, Alert } from "@/components/ds/card";
import { DeleteFamilyForm } from "./delete-family-form";

export const metadata = { title: "Your data" };

export default async function DataPage() {
  const actor = await requireVerifiedActor();
  const family = await currentFamily(actor);

  return (
    <>
      <PageHeader
        title="Your data"
        subtitle="Portability and deletion. Your data belongs to you."
      />

      <Card>
        <h2 className="mb-1 text-sm font-semibold">Export everything</h2>
        <p className="mb-4 text-sm text-muted">
          Download a complete JSON snapshot of your family: accounts, entries, categories, tags,
          sharing, and exchange rates.
        </p>
        <a
          href="/api/export"
          className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg"
          download
        >
          Download export
        </a>
      </Card>

      <Alert title="Deleting your family is permanent" tone="destructive">
        Every account, transaction, category, and member record will be destroyed immediately. There
        is no undo. Export first if you might want the data later.
      </Alert>

      {actor.familyRole === "admin" ? (
        <Card className="border-destructive/40">
          <h2 className="mb-3 text-sm font-semibold text-destructive">Delete family “{family.name}”</h2>
          <DeleteFamilyForm familyName={family.name} />
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-muted">Only a family admin can delete the whole family.</p>
        </Card>
      )}
    </>
  );
}
