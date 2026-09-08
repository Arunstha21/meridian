import { requireVerifiedActor, currentFamily } from "@/server/auth/context";
import { getDb } from "@/server/db/client";
import { budgetOverview } from "@/server/domain/budgets";
import { getUserPrivacyMode } from "@/server/domain/users";
import { PageHeader } from "@/components/ds/card";
import { BudgetsView } from "./budgets-view";
import { formatMonthKey } from "@/lib/datetime";

export const metadata = { title: "Budgets" };

export default async function BudgetsPage() {
  const actor = await requireVerifiedActor();
  const family = await currentFamily(actor);
  const overview = await budgetOverview(getDb(), family, actor.userId);
  const privacy = await getUserPrivacyMode(getDb(), actor.userId);

  return (
    <div className="space-y-6 pb-6 lg:pb-12">
      <PageHeader
        title="Budgets"
        subtitle={`Monthly limits per category, plus an overall cap. ${formatMonthKey(overview.monthKey, family.locale)}.`}
      />
      <BudgetsView
        currency={family.currency}
        overall={overview.overall}
        perCategory={overview.perCategory}
        categoriesWithoutBudget={overview.categoriesWithoutBudget}
        monthLabel={formatMonthKey(overview.monthKey, family.locale)}
        privacy={privacy}
      />
    </div>
  );
}
