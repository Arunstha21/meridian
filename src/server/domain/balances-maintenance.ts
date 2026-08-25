import { sql } from "drizzle-orm";
import type { Executor } from "../db/client";
import { recalculateAccount } from "./balances";
import { captureDebugLog } from "../observability/debug-log";

export async function recalculateAllActiveAccounts(exec: Executor): Promise<number> {
  const res = await exec.execute<{ id: string }>(sql`
    SELECT id::text AS id FROM accounts WHERE status = 'active' ORDER BY created_at
  `);
  const ids = (res.rows ?? []).map((r) => r.id);
  let ok = 0;
  for (const id of ids) {
    try {
      await recalculateAccount(exec, id);
      ok++;
    } catch (e) {
      await captureDebugLog(exec, {
        category: "balances",
        level: "error",
        message: "Scheduled balance recalculation failed for an account",
        source: "worker",
        metadata: { accountId: id, error: e instanceof Error ? e.message : String(e) }
      });
    }
  }
  return ok;
}
