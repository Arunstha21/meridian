import { requireVerifiedActor, currentFamily } from "@/server/auth/context";
import { Card, PageHeader } from "@/components/ds/card";
import { NewAccountForm } from "./new-account-form";

export const metadata = { title: "Add account" };

export default async function NewAccountPage() {
  await requireVerifiedActor();
  const family = await currentFamily(await requireVerifiedActor());
  return (
    <>
      <PageHeader title="Add an account" subtitle="Manual accounts only — no bank connections in this release." />
      <Card>
        <NewAccountForm defaultCurrency={family.currency} />
      </Card>
    </>
  );
}
