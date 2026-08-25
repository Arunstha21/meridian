import Link from "next/link";
import { requireVerifiedActor } from "@/server/auth/context";
import { getDb } from "@/server/db/client";
import { listAccountsForActor, isLiability } from "@/server/domain/accounts";
import { getUserPrivacyMode } from "@/server/domain/users";
import { Badge, EmptyState, PageHeader } from "@/components/ds/card";
import { Amount } from "@/components/finance/amount";

export const metadata = { title: "Accounts" };

export default async function AccountsPage() {
  const actor = await requireVerifiedActor();
  const db = getDb();
  const accounts = await listAccountsForActor(db, actor);
  const privacy = await getUserPrivacyMode(db, actor.userId);

  const assets = accounts.filter((a) => !isLiability(a.type));
  const liabilities = accounts.filter((a) => isLiability(a.type));

  return (
    <>
      <PageHeader
        title="Accounts"
        actions={
          <Link href="/accounts/new" className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg">
            Add account
          </Link>
        }
      />

      <AccountGroup title="Assets" items={assets} privacy={privacy} />
      <AccountGroup title="Liabilities" items={liabilities} privacy={privacy} />
    </>
  );
}

function AccountGroup({
  title,
  items,
  privacy
}: {
  title: string;
  items: Awaited<ReturnType<typeof listAccountsForActor>>;
  privacy: boolean;
}) {
  if (items.length === 0) {
    return (
      <section aria-label={title}>
        <EmptyState title={`No ${title.toLowerCase()} yet`} />
      </section>
    );
  }
  return (
    <section aria-label={title}>
      <h2 className="mb-2 px-1 text-sm font-medium uppercase tracking-wide text-muted">{title}</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((a) => (
          <li key={a.id}>
            <Link
              href={`/accounts/${a.id}`}
              className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-border/20"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.name}</p>
                  <p className="text-xs text-muted">{labelForType(a.type)}{a.institution ? ` · ${a.institution}` : ""}</p>
                </div>
                <Amount minor={a.displayBalanceMinor} currency={a.currency} masked={privacy} className="font-semibold" />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {!a.isJoint ? <Badge tone="primary">shared</Badge> : null}
                {a.status !== "active" ? <Badge tone="warning">{a.status}</Badge> : null}
                {!a.includedInReports ? <Badge tone="neutral">excluded from reports</Badge> : null}
                {a.level !== "full_control" ? <Badge tone="neutral">{permissionLabel(a.level)}</Badge> : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function labelForType(type: string): string {
  switch (type) {
    case "depository":
      return "Cash";
    case "credit_card":
      return "Credit card";
    case "other_asset":
      return "Other asset";
    case "other_liability":
      return "Other liability";
    default:
      return type;
  }
}

function permissionLabel(level: string): string {
  switch (level) {
    case "read_only":
      return "view only";
    case "read_write":
      return "can edit details";
    default:
      return level;
  }
}