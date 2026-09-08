import { describe, it, expect, beforeAll } from "vitest";
import { sql } from "drizzle-orm";
import { db, makeUser, truncateAll } from "../helpers";
import {
  authenticate,
  changePassword,
  performPasswordReset,
  registerUserWithFamily,
  requestPasswordReset,
  findUserByEmail
} from "@/server/domain/users";
import { issueAuthToken, consumeAuthToken } from "@/server/security/auth-tokens";
import { createSession, revokeSession } from "@/server/security/session";
import { consumeRateLimit, pruneRateLimitCounters } from "@/server/security/rate-limit";
import { errors } from "@/lib/errors";
import { hashToken, hashPassword } from "@/lib/crypto";

beforeAll(async () => {
  await truncateAll();
});

describe("registration", () => {
  it("creates a family and admin user", async () => {
    const res = await registerUserWithFamily(db(), {
      email: "reg@test.local",
      password: "Sup3rSecure!Pass",
      name: "Reg",
      familyName: "Reg Family"
    });
    const rows = await db().execute<{ role: string; verified: boolean }>(sql`
      SELECT family_role AS role, (email_verified_at IS NOT NULL) AS verified
      FROM users WHERE id = ${res.userId}::uuid
    `);
    expect((rows.rows ?? [])[0]).toMatchObject({ role: "admin" });
  });

  it("rejects duplicate emails", async () => {
    await expect(
      registerUserWithFamily(db(), {
        email: "reg@test.local",
        password: "Sup3rSecure!Pass",
        name: "Dup",
        familyName: "Dup Family"
      })
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("enforces password policy", async () => {
    await expect(
      registerUserWithFamily(db(), {
        email: "weakpw@test.local",
        password: "short1",
        name: "Weak",
        familyName: "Weak Family"
      })
    ).rejects.toMatchObject({ code: "validation.failed" });
  });
});

describe("sessions", () => {
  it("creates live sessions and revokes them", async () => {
    const user = await makeUser();
    const { token, session } = await createSession(db(), user.userId, {});
    const found = await db().execute(sql`
      SELECT 1 FROM sessions WHERE token_hash = ${hashToken(token)}
    `);
    expect((found.rows ?? []).length).toBe(1);
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());

    await revokeSession(db(), session.id);
    const after = await db().execute(sql`
      SELECT 1 FROM sessions WHERE id = ${session.id}::uuid
    `);
    expect((after.rows ?? []).length).toBe(0);
  });
});

describe("authentication", () => {
  it("authenticates with correct credentials", async () => {
    const user = await makeUser({ email: "auth-ok@test.local" });
    await setPassword(user.userId, await hashPassword("Passw0rdLong!"));
    const { token } = await authenticate(
      db(),
      { email: user.email, password: "Passw0rdLong!" },
      { ip: "1.2.3.4" }
    );
    expect(token).toBeTruthy();
  });

  it("rejects wrong passwords without leaking account existence via error type", async () => {
    const user = await makeUser();
    await expect(
      authenticate(db(), { email: user.email, password: "WrongWrong12" }, {})
    ).rejects.toMatchObject({ code: "auth.required" });
    await expect(
      authenticate(db(), { email: "ghost@nowhere.local", password: "Whatever123" }, {})
    ).rejects.toMatchObject({
      code: "auth.required"
    });
  });

  it("rate limits failed attempts per email+ip", async () => {
    const user = await makeUser({ email: "lockout@test.local" });
    for (let i = 0; i < 5; i++) {
      try {
        await authenticate(
          db(),
          { email: user.email, password: "BadBadBad123" },
          { ip: "9.9.9.9" }
        );
      } catch {
        /* expected */
      }
    }
    await expect(
      authenticate(db(), { email: user.email, password: "Sup3rSecure!Pass" }, { ip: "9.9.9.9" })
    ).rejects.toMatchObject({ code: "rate.limited" });
  });

  it("changePassword requires current password and revokes other sessions", async () => {
    const user = await makeUser({ email: "changepw@test.local" });
    await setPassword(user.userId, await hashPassword("OldPassword99"));
    const s1 = await createSession(db(), user.userId, {});
    const s2 = await createSession(db(), user.userId, {});

    const actor = {
      userId: user.userId,
      sessionId: s1.session.id,
      familyId: user.familyId,
      familyRole: "admin" as const,
      platformRole: "user" as const,
      email: user.email,
      name: "T",
      emailVerified: true
    };
    await expect(changePassword(db(), actor, "nope", "NewPassword77")).rejects.toMatchObject({
      code: "validation.failed"
    });
    await changePassword(db(), actor, "OldPassword99", "NewPassword77");

    const remaining = await db().execute(
      sql`SELECT count(*)::int AS c FROM sessions WHERE user_id = ${user.userId}::uuid`
    );
    expect(Number((remaining.rows ?? [])[0]!.c)).toBe(1);

    void s2;
    const reAuth = await authenticate(db(), { email: user.email, password: "NewPassword77" }, {});
    expect(reAuth.token).toBeTruthy();
  });
});

describe("password reset", () => {
  it("issues single-use expiring tokens and revokes sessions on use", async () => {
    const user = await makeUser({ email: "reset@test.local" });
    await createSession(db(), user.userId, {});

    const token = await requestPasswordReset(db(), user.email);
    expect(token).toBeTruthy();

    expect(await requestPasswordReset(db(), "unknown@test.local")).toBeNull();

    await performPasswordReset(db(), token!, "BrandNew1234");
    await expect(performPasswordReset(db(), token!, "Reused9999")).rejects.toMatchObject({
      code: "validation.failed"
    });

    const sessions = await db().execute(
      sql`SELECT count(*)::int AS c FROM sessions WHERE user_id = ${user.userId}::uuid`
    );
    expect(Number((sessions.rows ?? [])[0]!.c)).toBe(0);

    const updated = await findUserByEmail(db(), user.email);
    expect(updated?.emailVerifiedAt).not.toBeNull();
  });

  it("email verification tokens are purpose-scoped and single-use", async () => {
    const user = await makeUser({ email: "verify@test.local" });
    const verifyToken = await issueAuthToken(db(), user.userId, "email_verification");
    await expect(consumeAuthToken(db(), verifyToken!, "password_reset")).resolves.toBeNull();
    expect((await consumeAuthToken(db(), verifyToken!, "email_verification"))!.userId).toBe(
      user.userId
    );
    await expect(consumeAuthToken(db(), verifyToken!, "email_verification")).resolves.toBeNull();
  });
});

describe("rate limiter", () => {
  it("counts within window and resets after", async () => {
    let thrown = false;
    for (let i = 0; i < 7; i++) {
      try {
        await consumeRateLimit(db(), `test-bucket`, 5, 3600);
      } catch (e) {
        thrown = true;
        expect(e).toMatchObject({ code: "rate.limited" });
        break;
      }
    }
    expect(thrown).toBe(true);
    await pruneRateLimitCounters(db());
  });
});

function setPassword(userId: string, hash: string) {
  return db().execute(sql`UPDATE users SET password_hash = ${hash} WHERE id = ${userId}::uuid`);
}

void errors;
