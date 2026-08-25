import { Executor } from "../db/client";
import { auditEvents } from "../db/schema";

export async function recordAudit(
  exec: Executor,
  input: {
    familyId?: string | null;
    actorUserId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await exec.insert(auditEvents).values({
    familyId: input.familyId ?? null,
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    metadata: input.metadata ?? {}
  });
}
