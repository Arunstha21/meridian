import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Executor } from "../db/client";
import { accountShares, accounts, entries, users } from "../db/schema";
import type { Actor } from "../auth/context";
import {
  ACCOUNT_TYPES,
  canManageAccountSettings,
  getAccountAccess,
  isValuationDriven,
  type AccountRow
} from "../authorization/access";
import { errors } from "@/lib/errors";
import { isValidCurrency } from "@/lib/money";
import { isIsoDate } from "@/lib/datetime";
import { recordAudit } from "../observability/audit";
import { recalculateAccount, latestBalancesFor } from "./balances";

export const ACCOUNT_TYPE_LABELS: Record<AccountRow["type"], string> = {
  depository: "Cash",
  credit_card: "Credit card",
  other_asset: "Other asset",
  other_liability: "Other liability"
};

export type CreateAccountInput = {
  type: string;
  name: string;
  currency: string;
  subtype?: string | null;
  institution?: string | null;
  openingBalanceDisplayMinor: number;
  openedOn: string;
  includedInReports: boolean;
  joint: boolean;
};

export async function createAccount(
  exec: Executor,
  actor: Actor,
  input: CreateAccountInput
): Promise<{ accountId: string }> {
  if (!(ACCOUNT_TYPES as readonly string[]).includes(input.type)) {
    throw errors.validation("Unsupported account type.");
  }
  const name = input.name.trim();
  if (!name || name.length > 120) throw errors.validation("Account name must be 1–120 characters.");
  if (!isValidCurrency(input.currency)) throw errors.validation("Unknown currency code.");
  if (!isIsoDate(input.openedOn)) throw errors.validation("Opened-on date must be YYYY-MM-DD.");
  try {
    await exec.execute(sql`SELECT 1`);
  } catch {
    throw errors.validation("Database unavailable.");
  }

  const opening = input.openingBalanceDisplayMinor;
  const accountId = await exec.transaction(async (tx) => {
    const [account] = await tx
      .insert(accounts)
      .values({
        familyId: actor.familyId,
        ownerId: input.joint ? null : actor.userId,
        type: input.type,
        subtype: input.subtype?.trim() || null,
        name,
        institution: input.institution?.trim() || null,
        currency: input.currency.toUpperCase(),
        status: "active",
        includedInReports: input.includedInReports,
        openingBalanceMinor: opening,
        openedOn: input.openedOn
      })
      .returning({ id: accounts.id });
    return account!.id;
  });

  await recalculateAccount(exec, accountId);
  await recordAudit(exec, {
    familyId: actor.familyId,
    actorUserId: actor.userId,
    action: "account.created",
    entityType: "account",
    entityId: accountId,
    metadata: { type: input.type, joint: input.joint }
  });
  return { accountId };
}

async function requireFullControl(exec: Executor, actor: Actor, accountId: string) {
  const access = await getAccountAccess(exec, actor, accountId);
  if (!access.granted) throw errors.notFound("Account");
  if (!canManageAccountSettings(access.level)) throw errors.forbidden();
  return access.account;
}

export async function updateAccount(
  exec: Executor,
  actor: Actor,
  accountId: string,
  patch: {
    name?: string;
    institution?: string | null;
    subtype?: string | null;
    includedInReports?: boolean;
    openingBalanceDisplayMinor?: number;
    openedOn?: string;
  }
): Promise<void> {
  const account = await requireFullControl(exec, actor, accountId);
  const updates: Partial<typeof accounts.$inferInsert> = { updatedAt: new Date() };
  let needsRecalc = false;

  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name || name.length > 120) throw errors.validation("Account name must be 1–120 characters.");
    updates.name = name;
  }
  if (patch.institution !== undefined) updates.institution = patch.institution?.trim() || null;
  if (patch.subtype !== undefined) updates.subtype = patch.subtype?.trim() || null;
  if (patch.includedInReports !== undefined) updates.includedInReports = patch.includedInReports;
  if (patch.openingBalanceDisplayMinor !== undefined) {
    updates.openingBalanceMinor = patch.openingBalanceDisplayMinor;
    needsRecalc = true;
  }
  if (patch.openedOn !== undefined) {
    if (!isIsoDate(patch.openedOn)) throw errors.validation("Opened-on date must be YYYY-MM-DD.");
    updates.openedOn = patch.openedOn;
    needsRecalc = true;
  }

  await exec.update(accounts).set(updates).where(eq(accounts.id, accountId));
  if (needsRecalc && (updates.openedOn ?? account.openedOn)) {
    await recalculateAccount(exec, accountId);
  }
  await recordAudit(exec, {
    familyId: actor.familyId,
    actorUserId: actor.userId,
    action: "account.updated",
    entityType: "account",
    entityId: accountId,
    metadata: { fields: Object.keys(updates).filter((k) => k !== "updatedAt") }
  });
}

export async function setAccountStatus(
  exec: Executor,
  actor: Actor,
  accountId: string,
  status: "active" | "draft" | "disabled"
): Promise<void> {
  await requireFullControl(exec, actor, accountId);
  await exec.update(accounts).set({ status, updatedAt: new Date() }).where(eq(accounts.id, accountId));
  await recordAudit(exec, {
    familyId: actor.familyId,
    actorUserId: actor.userId,
    action: "account.status_changed",
    entityType: "account",
    entityId: accountId,
    metadata: { status }
  });
}

export async function deleteAccount(exec: Executor, actor: Actor, accountId: string): Promise<void> {
  await requireFullControl(exec, actor, accountId);
  await exec.delete(accounts).where(eq(accounts.id, accountId));
  await recordAudit(exec, {
    familyId: actor.familyId,
    actorUserId: actor.userId,
    action: "account.deleted",
    entityType: "account",
    entityId: accountId
  });
}

export async function shareAccount(
  exec: Executor,
  actor: Actor,
  accountId: string,
  targetUserId: string,
  permission: "full_control" | "read_write" | "read_only"
): Promise<void> {
  const account = await requireFullControl(exec, actor, accountId);
  if (targetUserId === actor.userId) throw errors.validation("You already have full access to this account.");
  const [target] = await exec.select().from(users).where(eq(users.id, targetUserId)).limit(1);
  if (!target || target.familyId !== account.familyId) {
    throw errors.validation("Shares can only be granted to members of the same family.");
  }
  await exec
    .insert(accountShares)
    .values({ accountId, userId: targetUserId, permission })
    .onConflictDoUpdate({
      target: [accountShares.accountId, accountShares.userId],
      set: { permission }
    });
  await recordAudit(exec, {
    familyId: actor.familyId,
    actorUserId: actor.userId,
    action: "account.shared",
    entityType: "account",
    entityId: accountId,
    metadata: { targetUserId, permission }
  });
}

export async function unshareAccount(
  exec: Executor,
  actor: Actor,
  accountId: string,
  targetUserId: string
): Promise<void> {
  await requireFullControl(exec, actor, accountId);
  await exec
    .delete(accountShares)
    .where(and(eq(accountShares.accountId, accountId), eq(accountShares.userId, targetUserId)));
  await recordAudit(exec, {
    familyId: actor.familyId,
    actorUserId: actor.userId,
    action: "account.unshared",
    entityType: "account",
    entityId: accountId,
    metadata: { targetUserId }
  });
}

export type AccountListItem = AccountRow & {
  displayBalanceMinor: number;
  level: "full_control" | "read_write" | "read_only";
  isJoint: boolean;
};

export async function listAccountsForActor(exec: Executor, actor: Actor): Promise<AccountListItem[]> {
  const rows = await exec
    .select({
      account: accounts,
      sharePermission: accountShares.permission
    })
    .from(accounts)
    .leftJoin(
      accountShares,
      and(eq(accountShares.accountId, accounts.id), eq(accountShares.userId, actor.userId))
    )
    .where(eq(accounts.familyId, actor.familyId));

  const visible = rows.filter(
    (r) => r.account.ownerId === null || r.account.ownerId === actor.userId || r.sharePermission !== null
  );

  const balanceMap = await latestBalancesFor(
    exec,
    visible.map((r) => r.account.id)
  );

  return visible.map(({ account, sharePermission }) => ({
    ...account,
    displayBalanceMinor:
      balanceMap.get(account.id)?.balanceMinor ??
      computeFallbackBalance(account),
    level:
      account.ownerId === null || account.ownerId === actor.userId
        ? ("full_control" as const)
        : (sharePermission as "full_control" | "read_write" | "read_only"),
    isJoint: account.ownerId === null
  }));
}

function computeFallbackBalance(account: AccountRow): number {
  return account.openingBalanceMinor;
}

export function groupByAssets(items: AccountListItem[]): {
  assets: AccountListItem[];
  liabilities: AccountListItem[];
} {
  const assets = items.filter((a) => !a.type.includes("credit_card") && a.type !== "other_liability");
  const liabilities = items.filter((a) => a.type === "credit_card" || a.type === "other_liability");
  return { assets, liabilities };
}

export type AccountOverview = {
  account: AccountRow;
  level: "full_control" | "read_write" | "read_only";
  isJoint: boolean;
  displayBalanceMinor: number;
  series: { date: string; balanceMinor: number }[];
  recentActivity: {
    id: string;
    date: string;
    name: string;
    amountMinor: number;
    kind: "transaction" | "valuation";
  }[];
  shares: { userId: string; userName: string; userEmail: string; permission: string }[];
  valuationDriven: boolean;
};

const LIABILITY_TYPES = new Set(["credit_card", "other_liability"]);

export function isLiability(type: string): boolean {
  return LIABILITY_TYPES.has(type);
}

export async function getAccountOverview(
  exec: Executor,
  actor: Actor,
  accountId: string,
  opts: { seriesDays?: number; activityLimit?: number } = {}
): Promise<AccountOverview> {
  const access = await getAccountAccess(exec, actor, accountId);
  if (!access.granted) throw errors.notFound("Account");
  const { account, level } = access;

  const seriesDays = opts.seriesDays ?? 60;

  const balanceRows = await exec.execute<{ as_of: string; balance_minor: string }>(sql`
    SELECT as_of::text AS as_of, balance_minor::text AS balance_minor
    FROM balances WHERE account_id = ${accountId}::uuid AND as_of >= current_date - ${String(seriesDays)}::int
    ORDER BY as_of
  `);

  const [latest] = await exec
    .execute<{ balance_minor: string }>(sql`
      SELECT balance_minor::text AS balance_minor FROM balances
      WHERE account_id = ${accountId}::uuid ORDER BY as_of DESC LIMIT 1
    `)
    .then((r) => r.rows ?? []);

  const activityRows = await exec
    .select({
      id: entries.id,
      date: entries.date,
      name: entries.name,
      amountMinor: entries.amountMinor,
      entryableType: entries.entryableType
    })
    .from(entries)
    .where(eq(entries.accountId, accountId))
    .orderBy(desc(entries.date), desc(entries.createdAt))
    .limit(opts.activityLimit ?? 15);

  const shareRows = await exec
    .select({
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
      permission: accountShares.permission
    })
    .from(accountShares)
    .innerJoin(users, eq(users.id, accountShares.userId))
    .where(eq(accountShares.accountId, accountId));

  return {
    account,
    level,
    isJoint: account.ownerId === null,
    displayBalanceMinor: Number(latest?.balance_minor ?? account.openingBalanceMinor),
    series: (balanceRows.rows ?? []).map((r) => ({
      date: r.as_of.slice(0, 10),
      balanceMinor: Number(r.balance_minor)
    })),
    recentActivity: activityRows.map((r) => ({
      id: r.id,
      date: r.date,
      name: r.name,
      amountMinor: r.amountMinor,
      kind: r.entryableType === "valuation" ? ("valuation" as const) : ("transaction" as const)
    })),
    shares: shareRows,
    valuationDriven: isValuationDriven(account.type)
  };
}

export async function familyMemberOptions(exec: Executor, familyId: string) {
  return exec
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.familyId, familyId))
    .orderBy(users.name);
}

export async function accountsExistForFamily(exec: Executor, familyId: string, ids: string[]) {
  if (ids.length === 0) return true;
  const rows = await exec
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.familyId, familyId), inArray(accounts.id, ids)));
  return rows.length === ids.length;
}
