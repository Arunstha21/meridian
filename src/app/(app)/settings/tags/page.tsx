import { requireVerifiedActor } from "@/server/auth/context";
import { getDb } from "@/server/db/client";
import { listTags } from "@/server/domain/tags";
import { PageHeader } from "@/components/ds/card";
import { TagManager } from "./manager";

export const metadata = { title: "Tags" };

export default async function TagsPage() {
  const actor = await requireVerifiedActor();
  const tags = await listTags(getDb(), actor.familyId);

  return (
    <>
      <PageHeader title="Tags" subtitle="Flexible labels you can combine on any transaction." />
      <TagManager tags={tags.map((t) => ({ id: t.id, name: t.name, color: t.color }))} />
    </>
  );
}
