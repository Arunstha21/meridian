import { Suspense } from "react";
import { requireVerifiedActor, currentFamily } from "@/server/auth/context";
import { getDb } from "@/server/db/client";
import { listAccountsForActor } from "@/server/domain/accounts";
import { listCategories } from "@/server/domain/categories";
import { PageHeader } from "@/components/ds/card";
import { NewTransactionForms } from "./forms";

export const metadata = { title: "New transaction" };

export default async function NewTransactionPage() {
  const actor = await requireVerifiedActor();
  const family = await currentFamily(actor);
  const db = getDb();
  const accounts = await listAccountsForActor(db, actor);
  const categories = await listCategories(db, actor.familyId);

  return (
    <>
      <PageHeader title="New transaction" subtitle={`Amounts are recorded in ${family.currency} family context per account currency.`} />
      <Suspense>
        <NewTransactionForms
          accounts={accounts
            .filter((a) => a.status === "active")
            .map((a) => ({ id: a.id, name: a.name, currency: a.currency }))}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        />
      </Suspense>
    </>
  );
}
