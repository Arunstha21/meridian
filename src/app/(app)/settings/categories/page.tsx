import { requireVerifiedActor, currentFamily } from "@/server/auth/context";
import { getDb } from "@/server/db/client";
import { listCategories } from "@/server/domain/categories";
import { PageHeader, EmptyState } from "@/components/ds/card";
import { CategoryManager } from "./manager";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const actor = await requireVerifiedActor();
  const family = await currentFamily(actor);
  const categories = await listCategories(getDb(), actor.familyId);

  return (
    <>
      <PageHeader title="Categories" subtitle="Organize spending and income. One nesting level." />
      {categories.length === 0 ? (
        <EmptyState title="No categories yet" hint="Create your first category below." />
      ) : null}
      <CategoryManager categories={categories} currency={family.currency} />
    </>
  );
}
