import { PageHeader, Alert } from "@/components/ds/card";
import { requireVerifiedActor } from "@/server/auth/context";
import { getDb } from "@/server/db/client";
import { listMeroShareConnections } from "@/server/domain/meroshare";
import { MeroShareManager } from "./manager";

export const metadata = { title: "MeroShare" };

export default async function MeroSharePage() {
  const actor = await requireVerifiedActor();
  const connections = await listMeroShareConnections(getDb(), actor);
  return (
    <>
      <PageHeader
        title="MeroShare"
        subtitle="Read-only CDSC portfolio sync for your NEPSE investments."
      />
      <Alert title="Portfolio values, not cash transactions" tone="warning">
        MeroShare reports holdings and ownership changes, not a brokerage cash ledger. Meridian
        keeps the synced portfolio as an investment valuation and never invents cash movements from
        share trades.
      </Alert>
      <MeroShareManager connections={connections} />
    </>
  );
}
