import { notFound } from "next/navigation";
import { requireVerifiedActor } from "@/server/auth/context";
import { getDb } from "@/server/db/client";
import { getEntryDetail } from "@/server/domain/entries";
import { listCategories } from "@/server/domain/categories";
import { listTags } from "@/server/domain/tags";
import { suggestTransferMatches } from "@/server/domain/transfers";
import { PageHeader } from "@/components/ds/card";
import { TransactionDetailClient } from "./detail-client";
import { fmtDate } from "@/lib/format";

export const metadata = { title: "Transaction" };

export default async function TransactionDetailPage({
  params
}: {
  params: Promise<{ entryId: string }>;
}) {
  const { entryId } = await params;
  const actor = await requireVerifiedActor();
  const db = getDb();

  let detail;
  try {
    detail = await getEntryDetail(db, actor, entryId);
  } catch {
    notFound();
  }

  const [categories, tags, suggestions] = await Promise.all([
    listCategories(db, actor.familyId),
    listTags(db, actor.familyId),
    detail.transferId ? Promise.resolve([]) : suggestTransferMatches(db, actor, entryId)
  ]);

  return (
    <div className="space-y-6 pb-6 lg:pb-12">
      <PageHeader
        title={detail.entry.name}
        subtitle={`Recorded ${fmtDate(detail.entry.date)} · ${detail.account.name}`}
      />
      <TransactionDetailClient
        entry={detail.entry}
        level={detail.level}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        tags={tags.map((t) => ({ id: t.id, name: t.name }))}
        categoryId={detail.categoryId}
        tagIds={detail.tagIds}
        merchant={detail.merchant}
        transferId={detail.transferId}
        transferPartnerName={detail.transferPartner?.accountName}
        parentId={detail.parentId}
        splits={detail.children.map((c) => ({
          id: c.id,
          name: c.name,
          amountMinor: c.amountMinor
        }))}
        suggestions={suggestions}
      />
    </div>
  );
}
