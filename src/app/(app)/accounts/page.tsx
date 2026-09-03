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
    <div className="space-y-6 pb-6 lg:pb-12">
      <PageHeader
        title="Accounts"
        actions={
          <Link
            href="/accounts/new"
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg"
          >
            Add account
          </Link>
        }
      />

      <AccountGroup title="Assets" items={assets} privacy={privacy} />
      <AccountGroup title="Liabilities" items={liabilities} privacy={privacy} />
    </div>
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
      <section aria-label={title} className="rounded-xl bg-surface-inset p-1">
        <EmptyState title={`No ${title.toLowerCase()} yet`} />
      </section>
    );
  }
  return (
    <section aria-label={title} className="rounded-xl bg-surface-inset p-1">
      <div className="flex items-center justify-between px-3 py-2 text-xs font-medium text-muted">
        <h2>{title}</h2>
        <span>{items.length}</span>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
        {items.map((a) => (
          <li key={a.id}>
            <Link
              href={`/accounts/${a.id}`}
              className="flex items-center justify-between gap-3 px-4 py-4 transition-colors hover:bg-surface-hover"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{a.name}</p>
                <p className="text-xs text-muted">
                  {a.institution === "MeroShare" ? "MeroShare investment" : labelForType(a.type)}
                  {a.institution ? ` · ${a.institution}` : ""}
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {!a.isJoint ? <Badge tone="primary">personal</Badge> : null}
                  {a.status !== "active" ? <Badge tone="warning">{a.status}</Badge> : null}
                  {!a.includedInReports ? (
                    <Badge tone="neutral">excluded from reports</Badge>
                  ) : null}
                  {a.level !== "full_control" ? (
                    <Badge tone="neutral">{permissionLabel(a.level)}</Badge>
                  ) : null}
                </div>
              </div>
              <Amount
                minor={a.displayBalanceMinor}
                currency={a.currency}
                masked={privacy}
                className="shrink-0 font-semibold"
              />
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
