import { Suspense } from "react";
import { requireVerifiedActor, currentFamily } from "@/server/auth/context";
import { getDb } from "@/server/db/client";
import { listAccountsForActor } from "@/server/domain/accounts";
import { listCategories } from "@/server/domain/categories";
import { listTags } from "@/server/domain/tags";
import { PageHeader } from "@/components/ds/card";
import { NewTransactionForms } from "./forms";
import { todayIn } from "@/lib/datetime";

export const metadata = { title: "New transaction" };

export default async function NewTransactionPage() {
  const actor = await requireVerifiedActor();
  const family = await currentFamily(actor);
  const db = getDb();
  const [accounts, categories, tags] = await Promise.all([
    listAccountsForActor(db, actor),
    listCategories(db, actor.familyId),
    listTags(db, actor.familyId)
  ]);

  return (
    <div className="max-w-4xl space-y-6 pb-6 lg:pb-12">
      <PageHeader
        title="New transaction"
        subtitle={`Amounts are recorded in ${family.currency} family context per account currency.`}
      />
      <Suspense>
        <NewTransactionForms
          accounts={accounts
            .filter((a) => a.status === "active")
            .map((a) => ({ id: a.id, name: a.name, currency: a.currency }))}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          tags={tags.map((t) => ({ id: t.id, name: t.name }))}
          today={todayIn(family.timezone)}
        />
      </Suspense>
    </div>
  );
}
