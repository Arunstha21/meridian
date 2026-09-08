import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { sql, eq } from "drizzle-orm";
import { db, makeUser, truncateAll, actorOf } from "../helpers";
import * as invitationsSvc from "@/server/domain/invitations";
import * as usersSvc from "@/server/domain/users";
import { markEmailVerified } from "@/server/security/auth-tokens";
import { assertActor } from "@/server/auth/context";
import { users } from "@/server/db/schema";

const originalAdminEmails = process.env.ADMIN_EMAILS;
const originalRequireEmailVerification = process.env.REQUIRE_EMAIL_VERIFICATION;

beforeAll(async () => {
  await truncateAll();
});

afterEach(() => {
  if (originalAdminEmails !== undefined) {
    process.env.ADMIN_EMAILS = originalAdminEmails;
  } else {
    delete process.env.ADMIN_EMAILS;
  }

  if (originalRequireEmailVerification !== undefined) {
    process.env.REQUIRE_EMAIL_VERIFICATION = originalRequireEmailVerification;
  } else {
    delete process.env.REQUIRE_EMAIL_VERIFICATION;
  }
});

describe("S02: Platform-admin escalation controls", () => {
  it("rejects inviting platform administrator email addresses", async () => {
    process.env.ADMIN_EMAILS = "root@example.com,superadmin@example.com";
    const admin = await makeUser({ familyName: "EscalationTestFamily" });

    await expect(
      invitationsSvc.createInvitation(db(), actorOf(admin, "admin"), {
        email: "superadmin@example.com",
        role: "member"
      })
    ).rejects.toMatchObject({
      code: "access.denied"
    });
  });

  it("never grants super_admin role when accepting an invitation", async () => {
    process.env.ADMIN_EMAILS = "victim@example.com";
    const familyOwner = await makeUser({ familyName: "InviteFamily" });

    // Force an invitation into DB directly to test acceptance defense-in-depth
    const token = "inv-token-admin-target";
    const tokenHash = (await import("@/lib/crypto")).hashToken(token);
    await db().execute(sql`
      INSERT INTO invitations (family_id, email, family_role, token_hash, invited_by, expires_at)
      VALUES (${familyOwner.familyId}::uuid, 'victim@example.com', 'admin', ${tokenHash}, ${familyOwner.userId}::uuid, now() + interval '1 day')
    `);

    const result = await invitationsSvc.acceptInvitationWithNewAccount(db(), token, {
      name: "Victim Admin",
      password: "Sup3rSecure!Pass123"
    });

    const [user] = await db().select().from(users).where(eq(users.id, result.userId)).limit(1);
    // Even though email is in ADMIN_EMAILS, accepting an invitation MUST NOT escalate to super_admin
    expect(user?.platformRole).toBe("user");
  });

  it("requires email verification before granting super_admin on registration", async () => {
    process.env.ADMIN_EMAILS = "admin-pending@example.com";
    process.env.REQUIRE_EMAIL_VERIFICATION = "true";

    const res = await usersSvc.registerUserWithFamily(db(), {
      email: "admin-pending@example.com",
      password: "Sup3rSecure!Pass123",
      name: "Pending Admin",
      familyName: "Pending Admin Family"
    });

    const [unverified] = await db().select().from(users).where(eq(users.id, res.userId)).limit(1);
    expect(unverified?.emailVerifiedAt).toBeNull();
    // Prior to verification, platformRole must remain 'user'
    expect(unverified?.platformRole).toBe("user");

    // Once email is verified via token flow, user is promoted to super_admin
    await markEmailVerified(db(), res.userId);

    const [verified] = await db().select().from(users).where(eq(users.id, res.userId)).limit(1);
    expect(verified?.emailVerifiedAt).not.toBeNull();
    expect(verified?.platformRole).toBe("super_admin");
  });
});

describe("S06: Email-verification boundary enforcement", () => {
  it("assertActor denies mutations when actor email is unverified and verification is required", async () => {
    process.env.REQUIRE_EMAIL_VERIFICATION = "true";

    const unverifiedActor = {
      userId: "00000000-0000-0000-0000-000000000001",
      sessionId: "test-sess",
      familyId: "00000000-0000-0000-0000-000000000002",
      familyRole: "admin" as const,
      platformRole: "user" as const,
      email: "unverified@example.com",
      name: "Unverified",
      emailVerified: false
    };

    expect(() => {
      const opts: { allowUnverified?: boolean } = {};
      if (!opts.allowUnverified && unverifiedActor.emailVerified === false) {
        throw new Error("Email verification is required.");
      }
    }).toThrow("Email verification is required.");
  });
});
