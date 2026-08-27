import { requireVerifiedActor } from "@/server/auth/context";
import { getDb } from "@/server/db/client";
import { listSeries } from "@/server/domain/recurring";
import { listAccountsForActor } from "@/server/domain/accounts";
import { listCategories } from "@/server/domain/categories";
import { PageHeader } from "@/components/ds/card";
import { RecurringManager } from "./manager";

export const metadata = { title: "Recurring" };

export default async function RecurringPage() {
  const actor = await requireVerifiedActor();
  const db = getDb();

  const [series, accounts, categories] = await Promise.all([
    listSeries(db, actor.familyId),
    listAccountsForActor(db, actor),
    listCategories(db, actor.familyId)
  ]);

  return (
    <>
      <PageHeader
        title="Recurring transactions"
        subtitle="Bills and income posted automatically on a schedule."
      />
      <RecurringManager
        series={series.map((s) => ({
          id: s.id,
          accountName: s.accountName,
          name: s.name,
          merchant: s.merchant,
          amountMinor: s.amountMinor,
          currency: s.currency,
          frequency: s.frequency,
          config: s.config as Record<string, unknown>,
          nextDue: s.nextDue,
          active: s.active,
          accountStatus: s.accountStatus
        }))}
        accounts={accounts
          .filter((a) => a.status === "active")
          .map((a) => ({ id: a.id, name: a.name, currency: a.currency }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </>
  );
}
