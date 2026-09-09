import { and, eq } from "drizzle-orm";
import type { Executor } from "../db/client";
import { families, users } from "../db/schema";
import type { AccessIdentity } from "../auth/access";
import { findUserByEmail } from "./users";
import { recordAudit } from "../observability/audit";
import { errors } from "@/lib/errors";
import { isValidCurrency } from "@/lib/money";
import { validateTimezone } from "./families";

export async function findAccessUser(exec: Executor, identity: AccessIdentity) {
  const [user] = await exec
    .select()
    .from(users)
    .where(and(eq(users.accessSubject, identity.subject), eq(users.email, identity.email)))
    .limit(1);
  return user && !user.removedAt ? user : null;
}

/** Called only with an identity obtained by verifying the current Access assertion. */
export async function registerAccessHousehold(
  exec: Executor,
  identity: AccessIdentity,
  input: { name: string; familyName: string; currency: string; timezone: string }
) {
  const name = input.name.trim();
  const familyName = input.familyName.trim();
  if (!name || name.length > 120 || !familyName || familyName.length > 120) {
    throw errors.validation("Your name and household name must be 1–120 characters.");
  }
  const currency = input.currency.toUpperCase();
  if (!isValidCurrency(currency)) throw errors.validation("Unknown currency code.");
  const timezone = validateTimezone(input.timezone);
  // Do not silently link a pre-existing password account or reactivate a removed member.
  if (await findUserByEmail(exec, identity.email)) {
    throw errors.conflict(
      "This email already has an account. Ask the operator to review its access."
    );
  }
  return exec.transaction(async (tx) => {
    const [family] = await tx
      .insert(families)
      .values({ name: familyName, currency, timezone })
      .returning();
    const [user] = await tx
      .insert(users)
      .values({
        familyId: family!.id,
        email: identity.email,
        accessSubject: identity.subject,
        passwordHash: "!cloudflare-access",
        name,
        familyRole: "admin",
        platformRole: "user",
        emailVerifiedAt: new Date()
      })
      .returning();
    await recordAudit(tx, {
      familyId: family!.id,
      actorUserId: user!.id,
      action: "user.registered_with_access",
      entityType: "user",
      entityId: user!.id
    });
    return user!;
  });
}
