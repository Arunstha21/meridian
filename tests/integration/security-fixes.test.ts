import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { db, makeUser, truncateAll, actorOf } from "../helpers";
import * as invitationsSvc from "@/server/domain/invitations";
import * as usersSvc from "@/server/domain/users";
import { markEmailVerified } from "@/server/security/auth-tokens";
import { users, authTokens } from "@/server/db/schema";
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

    const [user] = await db().select().from(users).where(eq(users.id, accepted.userId));

    // Must be "user", NOT "super_admin"
    expect(user?.platformRole).toBe("user");
  });

  it("never grants super_admin at registration regardless of ADMIN_EMAILS or verification mode", async () => {
    // Verification disabled (the default): signup must never promote, even for a listed address.
    process.env.ADMIN_EMAILS = "listed-admin@example.com, verify-admin@example.com";
    process.env.REQUIRE_EMAIL_VERIFICATION = "false";

    const direct = await usersSvc.registerUserWithFamily(db(), {
      email: "listed-admin@example.com",
      password: "TestPassword123!Secure",
      name: "Listed Admin",
      familyName: "Listed Family"
    });
    const [directUser] = await db().select().from(users).where(eq(users.id, direct.userId));
    expect(directUser?.platformRole).toBe("user");

    // Verification enabled: signup stays a plain user, and completing email
    // verification must not promote either.
    process.env.REQUIRE_EMAIL_VERIFICATION = "true";
    const verifying = await usersSvc.registerUserWithFamily(db(), {
      email: "verify-admin@example.com",
      password: "TestPassword123!Secure",
      name: "Verifying Admin",
      familyName: "Verifying Family"
    });
    await markEmailVerified(db(), verifying.userId);
    const [verifiedUser] = await db().select().from(users).where(eq(users.id, verifying.userId));
    expect(verifiedUser?.emailVerifiedAt).not.toBeNull();
    expect(verifiedUser?.platformRole).toBe("user");
  });
});

describe("S13: Operator-only platform admin promotion", () => {
  it("requires proven inbox ownership before granting super_admin", async () => {
    // makeUser marks the email verified via direct UPDATE, but no emailed link
    // was ever consumed: inbox ownership is NOT proven yet.
    const owner = await makeUser();
    const outcome = await usersSvc.grantPlatformAdmin(db(), owner.email);
    expect(outcome.status).toBe("verification_required");
    const [stillUser] = await db().select().from(users).where(eq(users.id, owner.userId));
    expect(stillUser?.platformRole).toBe("user");

    // Simulate the account owner clicking the emailed link: a consumed token.
    await db()
      .insert(authTokens)
      .values({
        userId: owner.userId,
        purpose: "email_verification",
        tokenHash: hashToken("consumed-s13-verification-token"),
        expiresAt: new Date(Date.now() + 3_600_000),
        usedAt: new Date()
      });

    expect((await usersSvc.grantPlatformAdmin(db(), owner.email)).status).toBe("promoted");
    const [admin] = await db().select().from(users).where(eq(users.id, owner.userId));
    expect(admin?.platformRole).toBe("super_admin");

    // Re-running is idempotent, and the operator can demote.
    expect((await usersSvc.grantPlatformAdmin(db(), owner.email)).status).toBe("already_admin");
    expect(await usersSvc.revokePlatformAdmin(db(), owner.email)).toBe(true);
    const [demoted] = await db().select().from(users).where(eq(users.id, owner.userId));
    expect(demoted?.platformRole).toBe("user");
  });

  it("accepts a consumed password-reset token as inbox ownership proof", async () => {
    const owner = await makeUser();
    await db()
      .insert(authTokens)
      .values({
        userId: owner.userId,
        purpose: "password_reset",
        tokenHash: hashToken("consumed-s13-reset-token"),
        expiresAt: new Date(Date.now() + 3_600_000),
        usedAt: new Date()
      });
    expect((await usersSvc.grantPlatformAdmin(db(), owner.email)).status).toBe("promoted");
  });

  it("rejects promotion of unknown addresses", async () => {
    await expect(usersSvc.grantPlatformAdmin(db(), "ghost-s13@example.com")).rejects.toMatchObject({
      code: "resource.not_found"
    });
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
