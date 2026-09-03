import { requireVerifiedActor, currentFamily } from "@/server/auth/context";
import { Card, PageHeader } from "@/components/ds/card";
import { NewAccountForm } from "./new-account-form";
import { todayIn } from "@/lib/datetime";

export const metadata = { title: "Add account" };

export default async function NewAccountPage() {
  const actor = await requireVerifiedActor();
  const family = await currentFamily(actor);
  return (
    <div className="max-w-3xl space-y-6 pb-6 lg:pb-12">
      <PageHeader
        title="Add an account"
        subtitle="Manual accounts only — no bank connections in this release."
      />
      <Card>
        <NewAccountForm defaultCurrency={family.currency} today={todayIn(family.timezone)} />
      </Card>
    </div>
  );
}
