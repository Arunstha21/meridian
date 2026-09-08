import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { db, makeUser, truncateAll, actorOf } from "../helpers";
import * as invitationsSvc from "@/server/domain/invitations";
import * as usersSvc from "@/server/domain/users";
import { markEmailVerified } from "@/server/security/auth-tokens";
import { users } from "@/server/db/schema";
import { hashToken } from "@/lib/crypto";
import { assertActorVerified } from "@/server/auth/context";

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

describe("S02: Platform Admin Escalation Guards", () => {
  it("rejects invitations to addresses configured in ADMIN_EMAILS", async () => {
    process.env.ADMIN_EMAILS = "superadmin@example.com, platform-lead@meridian.local";

    const inviter = await makeUser();
    await expect(
      invitationsSvc.createInvitation(db(), actorOf(inviter), {
        email: "superadmin@example.com",
        role: "member"
      })
    ).rejects.toMatchObject({ code: "access.denied" });

    await expect(
      invitationsSvc.createInvitation(db(), actorOf(inviter), {
        email: "PLATFORM-LEAD@meridian.local",
        role: "admin"
      })
    ).rejects.toMatchObject({ code: "access.denied" });
  });

  it("does NOT grant super_admin upon accepting an invitation even if listed in ADMIN_EMAILS", async () => {
    process.env.ADMIN_EMAILS = "targeted-admin@example.com";
    const inviter = await makeUser();
    const rawToken = "test_raw_token_s02_unique";

    // Directly insert invitation targeting the admin email to simulate pre-existing or bypassed invitation
    await db()
      .insert((await import("@/server/db/schema")).invitations)
      .values({
        familyId: inviter.familyId,
        invitedBy: inviter.userId,
        email: "targeted-admin@example.com",
        familyRole: "admin",
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + 86400000)
      });

    // Claim invitation
    const accepted = await invitationsSvc.acceptInvitationWithNewAccount(db(), rawToken, {
      name: "Target Admin",
      password: "TestPassword123!Secure"
    });

    const [user] = await db()
      .select()
      .from(users)
      .where(eq(users.id, accepted.userId));

    // Must be "user", NOT "super_admin"
    expect(user?.platformRole).toBe("user");
  });

  it("requires email verification before granting super_admin on registration", async () => {
    process.env.ADMIN_EMAILS = "new-superadmin@example.com";
    process.env.REQUIRE_EMAIL_VERIFICATION = "true";

    const userRes = await usersSvc.registerUserWithFamily(db(), {
      email: "new-superadmin@example.com",
      password: "TestPassword123!Secure",
      name: "New Admin",
      familyName: "Admin Family"
    });

    // Before verification, platformRole must be "user"
    const [before] = await db().select().from(users).where(eq(users.id, userRes.userId));
    expect(before?.platformRole).toBe("user");
    expect(before?.emailVerifiedAt).toBeNull();

    // After email verification, platformRole should be upgraded to super_admin
    await markEmailVerified(db(), userRes.userId);
    const [after] = await db().select().from(users).where(eq(users.id, userRes.userId));
    expect(after?.emailVerifiedAt).not.toBeNull();
    expect(after?.platformRole).toBe("super_admin");
  });
});

describe("S06: Email Verification Mutation Guard", () => {
  it("blocks unverified users when REQUIRE_EMAIL_VERIFICATION is true", async () => {
    process.env.REQUIRE_EMAIL_VERIFICATION = "true";

    // Create user without verified email
    const unique = Math.random().toString(36).slice(2, 8);
    const reg = await usersSvc.registerUserWithFamily(db(), {
      email: `unverified-${unique}@test.local`,
      password: "Password123!Secure",
      name: "Unverified User",
      familyName: `Family ${unique}`
    });

    // Directly assert that unverified status blocks non-whitelisted actions
    const actor: import("@/server/auth/context").Actor = {
      userId: reg.userId,
      familyId: reg.familyId,
      familyRole: "admin",
      platformRole: "user",
      emailVerified: false,
      sessionId: "test-session-id",
      email: `unverified-${unique}@test.local`,
      name: "Unverified User"
    };

    expect(() => assertActorVerified(actor)).toThrowError();
  });
});
