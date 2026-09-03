import Link from "next/link";
import { requireVerifiedActor } from "@/server/auth/context";
import { getDb } from "@/server/db/client";
import { listEntriesPage, type EntryListItem } from "@/server/domain/entries";
import { listAccountsForActor } from "@/server/domain/accounts";
import { listCategories } from "@/server/domain/categories";
import { listTags } from "@/server/domain/tags";
import { getUserPrivacyMode } from "@/server/domain/users";
import { listSavedFilters } from "@/server/domain/saved-filters";
import { Card, EmptyState, PageHeader } from "@/components/ds/card";
import { Amount } from "@/components/finance/amount";
import { fmtDate } from "@/lib/format";
import { Select, Input } from "@/components/ds/form";
import { SubmitButton } from "@/components/ds/submit-button";
import { SavedFilterBar } from "./saved-filter-bar";

export const metadata = { title: "Transactions" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TransactionsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const actor = await requireVerifiedActor();
  const db = getDb();

  const one = (k: string): string | undefined => {
    const v = sp[k];
    return typeof v === "string" && v !== "" ? v : undefined;
  };

  const kind = one("kind") as "expense" | "income" | "transfer" | undefined;
  const cursorRaw = one("cursor");
  const cursor = cursorRaw ? (() => { try { return JSON.parse(cursorRaw) as { date: string; id: string }; } catch { return null; } })() : null;
  const direction = one("dir") === "prev" ? ("prev" as const) : ("next" as const);

  const filters = {
    accountId: one("account"),
    categoryId: one("category"),
    tagId: one("tag"),
    search: one("q"),
    kind,
    from: one("from"),
    to: one("to"),
    cursor,
    direction,
    limit: 25
  };

  const [page, accounts, categories, tags, savedFilters] = await Promise.all([
    listEntriesPage(db, actor, filters),
    listAccountsForActor(db, actor),
    listCategories(db, actor.familyId),
    listTags(db, actor.familyId),
    listSavedFilters(db, actor.userId)
  ]);
  const privacy = await getUserPrivacyMode(db, actor.userId);

  const currentParams: Record<string, string> = Object.fromEntries(
    Object.entries({
      q: filters.search,
      account: filters.accountId,
      category: filters.categoryId,
      tag: filters.tagId,
      kind: filters.kind,
      from: filters.from,
      to: filters.to
    }).flatMap(([k, v]) => (v !== undefined ? [[k, v] as const] : []))
  );

  const tagNameById = new Map(tags.map((t) => [t.id, t.name]));

  const listQuery = (c: { date: string; id: string } | null, dir?: "prev") => {
    if (!c) return "";
    const params = new URLSearchParams();
    for (const key of ["account", "category", "tag", "kind", "q", "from", "to"] as const) {
      const v = one(key);
      if (v) params.set(key, v);
    }
    params.set("cursor", JSON.stringify(c));
    if (dir === "prev") params.set("dir", "prev");
    return `?${params.toString()}`;
  };

  return (
    <div className="space-y-4 pb-6 lg:pb-12">
      <PageHeader
        title="Transactions"
        actions={
          <Link href="/transactions/new" className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-fg">
            New transaction
          </Link>
        }
      />

      {savedFilters.length > 0 || Object.keys(currentParams).length > 0 ? (
        <SavedFilterBar
          filters={savedFilters.map((f) => ({
            id: f.id,
            name: f.name,
            params: (f.params ?? {}) as Record<string, string>
          }))}
          currentParams={currentParams}
        />
      ) : null}

      <Card className="no-print overflow-hidden">
        <form method="get" className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="sm:col-span-2">
            <label htmlFor="q" className="sr-only">Search</label>
            <Input id="q" name="q" defaultValue={filters.search} placeholder="Search…" />
          </div>
          <div>
            <label htmlFor="account" className="sr-only">Account</label>
            <Select id="account" name="account" defaultValue={filters.accountId ?? ""}>
              <option value="">All accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="category" className="sr-only">Category</label>
            <Select id="category" name="category" defaultValue={filters.categoryId ?? ""}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="tag" className="sr-only">Tag</label>
            <Select id="tag" name="tag" defaultValue={filters.tagId ?? ""}>
              <option value="">Any tag</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>#{t.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="kind" className="sr-only">Type</label>
            <Select id="kind" name="kind" defaultValue={filters.kind ?? ""}>
              <option value="">Everything</option>
              <option value="expense">Expenses</option>
              <option value="income">Income</option>
              <option value="transfer">Transfers</option>
            </Select>
          </div>
          <div>
            <label htmlFor="from" className="sr-only">From date</label>
            <Input id="from" name="from" type="date" defaultValue={filters.from} aria-label="From date" />
          </div>
          <div>
            <label htmlFor="to" className="sr-only">To date</label>
            <Input id="to" name="to" type="date" defaultValue={filters.to} aria-label="To date" />
          </div>
          <SubmitButton>Apply filters</SubmitButton>
          <Link href="/transactions" className="self-center text-sm text-muted hover:underline">
            Clear
          </Link>
        </form>
      </Card>

      {page.items.length === 0 ? (
        <EmptyState title="No transactions found" hint="Try clearing the filters or record a new transaction." />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-160 text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th scope="col" className="px-4 py-3 font-medium">Date</th>
                <th scope="col" className="px-4 py-3 font-medium">Description</th>
                <th scope="col" className="px-4 py-3 font-medium">Account</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {page.items.map((e: EntryListItem) => (
                <tr key={e.id} className="transition-colors hover:bg-surface-hover">
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{fmtDate(e.date)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/transactions/${e.id}`} className="font-medium hover:underline">
                      {e.transferId ? <span aria-hidden>⇄ </span> : null}
                      {e.name}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      {e.categoryName ? <span>{e.categoryName}</span> : <span>Uncategorized</span>}
                      {e.merchant ? <span>· {e.merchant}</span> : null}
                      {e.tagIds.map((id) => (
                        <span key={id}>#{tagNameById.get(id) ?? "tag"}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{e.accountName}</td>
                  <td className="px-4 py-3 text-right">
                    <Amount minor={-e.amountMinor} currency={e.currency} masked={privacy} signed colorize />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            {page.hasPrevious && page.items[0] ? (
              <Link href={`/transactions${listQuery({ date: page.items[0].date, id: page.items[0].id }, "prev")}`} className="text-primary hover:underline">← Previous</Link>
            ) : (
              <span />
            )}
            {page.nextCursor ? (
              <Link href={`/transactions${listQuery(page.nextCursor)}`} className="text-primary hover:underline">
                Next →
              </Link>
            ) : (
              <span />
            )}
          </div>
        </Card>
      )}
    </div>
  );
}


