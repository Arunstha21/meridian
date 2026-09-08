import Link from "next/link";
import { requireVerifiedActor, currentFamily } from "@/server/auth/context";
import { getDb } from "@/server/db/client";
import { listAccountsForActor, isLiability } from "@/server/domain/accounts";
import { getUserPrivacyMode } from "@/server/domain/users";
import { PageHeader } from "@/components/ds/card";
import { Button } from "@/components/ui/button";
import { AccountsView } from "@/components/finance/account-grid";

export const metadata = { title: "Accounts" };

export default async function AccountsPage() {
  const actor = await requireVerifiedActor();
  const family = await currentFamily(actor);
  const db = getDb();
  const accounts = await listAccountsForActor(db, actor);
  const privacy = await getUserPrivacyMode(db, actor.userId);
  const assetsMinor = accounts
    .filter((account) => !isLiability(account.type) && account.status === "active")
    .reduce((sum, account) => sum + Math.max(0, account.displayBalanceMinor), 0);
  const liabilitiesMinor = accounts
    .filter((account) => isLiability(account.type) && account.status === "active")
    .reduce((sum, account) => sum + Math.abs(Math.min(0, account.displayBalanceMinor)), 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Accounts"
        subtitle="Balances from your ledger, grouped the way you use them."
        actions={<Button render={<Link href="/accounts/new" />}>Add account</Button>}
      />
      <AccountsView
        accounts={accounts.map((account) => ({
          id: account.id,
          name: account.name,
          type: account.type,
          institution: account.institution,
          displayBalanceMinor: account.displayBalanceMinor,
          currency: account.currency,
          status: account.status,
          isJoint: account.isJoint,
          level: account.level,
          includedInReports: account.includedInReports
        }))}
        privacy={privacy}
        assetsMinor={assetsMinor}
        liabilitiesMinor={liabilitiesMinor}
        currency={family.currency}
      />
    </div>
  );
}
