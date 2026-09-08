import { and, eq, isNull, sql } from "drizzle-orm";
import { Executor } from "../db/client";
import { authTokens, users } from "../db/schema";
import { hashToken, randomToken } from "@/lib/crypto";
import { env, adminEmails } from "@/lib/env";

export type TokenPurpose = "email_verification" | "password_reset";

const PURPOSE_TTL_MS: Record<TokenPurpose, number> = {
  email_verification: 48 * 3_600_000,
  password_reset: 3_600_000
};

export async function issueAuthToken(
  exec: Executor,
  userId: string,
  purpose: TokenPurpose
): Promise<string> {
  await exec
    .delete(authTokens)
    .where(and(eq(authTokens.userId, userId), eq(authTokens.purpose, purpose)));
  const token = randomToken(32);
  await exec.insert(authTokens).values({
    userId,
    purpose,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + PURPOSE_TTL_MS[purpose])
  });
  return token;
}

export async function consumeAuthToken(
  exec: Executor,
  token: string,
  purpose: TokenPurpose
): Promise<{ userId: string } | null> {
  const tokenHash = hashToken(token);
  const [row] = await exec
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(authTokens.tokenHash, tokenHash),
        eq(authTokens.purpose, purpose),
        isNull(authTokens.usedAt),
        sql`${authTokens.expiresAt} > now()`
      )
    )
    .returning({ userId: authTokens.userId });
  return row ? { userId: row.userId } : null;
}

export async function invalidateUserTokens(
  exec: Executor,
  userId: string,
  purpose?: TokenPurpose
): Promise<void> {
  if (purpose) {
    await exec
      .delete(authTokens)
      .where(and(eq(authTokens.userId, userId), eq(authTokens.purpose, purpose)));
  } else {
    await exec.delete(authTokens).where(eq(authTokens.userId, userId));
  }
}

export function verificationUrl(token: string): string {
  return `${env.APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
}

export function passwordResetUrl(token: string): string {
  return `${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
}

export async function markEmailVerified(exec: Executor, userId: string): Promise<void> {
  const [user] = await exec
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const shouldBePlatformAdmin = user && adminEmails().includes(user.email.toLowerCase());
  await exec
    .update(users)
    .set({
      emailVerifiedAt: new Date(),
      ...(shouldBePlatformAdmin ? { platformRole: "super_admin" as const } : {})
    })
    .where(eq(users.id, userId));
}
