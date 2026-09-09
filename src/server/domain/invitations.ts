import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { Executor } from "../db/client";
import { invitations, users } from "../db/schema";
import type { Actor } from "../auth/context";
import { hashPassword, hashToken, passwordPolicyError, randomToken } from "@/lib/crypto";
import { errors } from "@/lib/errors";
import { adminEmails, env, requireEmailVerification } from "@/lib/env";
import { recordAudit } from "../observability/audit";
import { findUserByEmail, EMAIL_PATTERN } from "./users";

const INVITE_TTL_MS = 7 * 86_400_000;
const MAX_PENDING_INVITES = 25;

export async function createInvitation(
  exec: Executor,
  actor: Actor,
  input: { email: string; role: "admin" | "member" }
): Promise<{ token: string }> {
  if (actor.familyRole !== "admin")
    throw errors.forbidden("Only family admins can invite members.");
  const email = input.email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) throw errors.validation("Enter a valid email address.");

  if (adminEmails().includes(email)) {
    throw errors.forbidden("Platform administrator addresses cannot be invited to join a family.");
  }

  const existing = await findUserByEmail(exec, email);
  // Removed members may be re-invited; accepting reactivates their account.
  if (existing && !existing.removedAt) {
    throw errors.conflict("That person already has an account.");
  }

  const [pending] = await exec
    .select({ count: sql<number>`count(*)::int` })
    .from(invitations)
    .where(and(eq(invitations.familyId, actor.familyId), isNull(invitations.acceptedAt)));
  if ((pending?.count ?? 0) >= MAX_PENDING_INVITES) {
    throw errors.conflict("Too many pending invitations. Revoke some first.");
  }

  await exec
    .delete(invitations)
    .where(
      and(
        eq(invitations.familyId, actor.familyId),
        isNull(invitations.acceptedAt),
        sql`lower(email) = ${email}`
      )
    );

  const token = randomToken(32);
  await exec.insert(invitations).values({
    familyId: actor.familyId,
    email,
    familyRole: input.role,
    tokenHash: hashToken(token),
    invitedBy: actor.userId,
    expiresAt: new Date(Date.now() + INVITE_TTL_MS)
  });

  await recordAudit(exec, {
    familyId: actor.familyId,
    actorUserId: actor.userId,
    action: "invitation.created",
    entityType: "invitation",
    metadata: { role: input.role }
  });

  return { token };
}

export function invitationUrl(token: string): string {
  return `${env.APP_URL}/invitations/${encodeURIComponent(token)}`;
}

export async function getInvitationByToken(exec: Executor, token: string) {
  if (!token) return null;
  const [row] = await exec
    .select({
      id: invitations.id,
      familyId: invitations.familyId,
      email: invitations.email,
      role: invitations.familyRole,
      expiresAt: invitations.expiresAt,
      familyName: sql<string>`(SELECT name FROM families WHERE families.id = ${invitations.familyId}::uuid)`,
      invitedByName: sql<string>`(SELECT name FROM users WHERE users.id = ${invitations.invitedBy}::uuid)`
    })
    .from(invitations)
    .where(and(eq(invitations.tokenHash, hashToken(token)), isNull(invitations.acceptedAt)))
    .limit(1);
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  return row;
}

export async function acceptInvitationForExistingUser(
  exec: Executor,
  token: string,
  user: { id: string; email: string }
): Promise<{ userId: string; familyId: string; role: string }> {
  return exec.transaction(async (tx) => {
    const invitation = await getInvitationByToken(tx, token);
    if (!invitation) throw errors.validation("This invitation link is invalid or has expired.");
    if (user.email.toLowerCase() !== invitation.email) {
      throw errors.forbidden("This invitation was sent to a different email address.");
    }
    const [row] = await tx
      .select({ removedAt: users.removedAt })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    if (row?.removedAt) {
      throw errors.forbidden(
        "This account has been removed from its family. Open the invitation while signed out to rejoin."
      );
    }
    await joinFamily(tx, invitation, user.id);
    return { userId: user.id, familyId: invitation.familyId, role: invitation.role };
  });
}

export async function acceptInvitationWithNewAccount(
  exec: Executor,
  token: string,
  input: { name: string; password: string }
): Promise<{ userId: string; familyId: string; role: string }> {
  const { assertPasswordAuth } = await import("../auth/access");
  assertPasswordAuth();
  const name = input.name.trim();
  if (!name || name.length > 120) throw errors.validation("Your name must be 1–120 characters.");
  const policy = passwordPolicyError(input.password);
  if (policy) throw errors.validation(policy);

  const mustVerify = requireEmailVerification();
  const passwordHash = await hashPassword(input.password);

  return exec.transaction(async (tx) => {
    const invitation = await getInvitationByToken(tx, token);
    if (!invitation) throw errors.validation("This invitation link is invalid or has expired.");

    const clash = await findUserByEmail(tx, invitation.email);
    let userId: string;
    if (clash) {
      if (!clash.removedAt) {
        throw errors.conflict("An account with this email already exists. Sign in to accept.");
      }
      // Reactivate the removed member's account under this invitation.
      // Receiving and accepting the emailed link proves inbox ownership.
      await tx
        .update(users)
        .set({
          familyId: invitation.familyId,
          passwordHash,
          name,
          familyRole: invitation.role as "admin" | "member",
          emailVerifiedAt: mustVerify ? null : new Date(),
          removedAt: null,
          updatedAt: new Date()
        })
        .where(eq(users.id, clash.id));
      userId = clash.id;
    } else {
      const [user] = await tx
        .insert(users)
        .values({
          familyId: invitation.familyId,
          email: invitation.email,
          passwordHash,
          name,
          familyRole: invitation.role,
          platformRole: "user",
          emailVerifiedAt: mustVerify ? null : new Date()
        })
        .returning({ id: users.id });
      userId = user!.id;
    }

    await joinFamily(tx, invitation, userId, { alreadyMember: true });
    return { userId, familyId: invitation.familyId, role: invitation.role };
  });
}

export async function acceptInvitationWithAccess(
  exec: Executor,
  token: string,
  identity: import("../auth/access").AccessIdentity,
  name: string
): Promise<void> {
  if (!name.trim() || name.trim().length > 120) throw errors.validation("Enter your name.");
  await exec.transaction(async (tx) => {
    const invitation = await getInvitationByToken(tx, token);
    if (!invitation) throw errors.validation("This invitation link is invalid or has expired.");
    if (invitation.email !== identity.email) {
      throw errors.forbidden("This invitation was sent to a different email address.");
    }
    const existing = await findUserByEmail(tx, identity.email);
    let userId: string;
    if (existing) {
      if (existing.accessSubject !== identity.subject) {
        throw errors.forbidden("This email is linked to a different sign-in identity.");
      }
      userId = existing.id;
      await tx
        .update(users)
        .set({ removedAt: null, emailVerifiedAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, userId));
    } else {
      const [user] = await tx
        .insert(users)
        .values({
          familyId: invitation.familyId,
          email: identity.email,
          accessSubject: identity.subject,
          passwordHash: "!cloudflare-access",
          name: name.trim(),
          familyRole: invitation.role,
          platformRole: "user",
          emailVerifiedAt: new Date()
        })
        .returning({ id: users.id });
      userId = user!.id;
    }
    await joinFamily(tx, invitation, userId);
  });
}

async function joinFamily(
  exec: Executor,
  invitation: { id: string; familyId: string; role: string },
  userId: string,
  opts: { alreadyMember?: boolean } = {}
): Promise<void> {
  if (!opts.alreadyMember) {
    await exec
      .update(users)
      .set({ familyId: invitation.familyId, familyRole: invitation.role as "admin" | "member" })
      .where(eq(users.id, userId));
  }
  await exec
    .update(invitations)
    .set({ acceptedAt: new Date() })
    .where(eq(invitations.id, invitation.id));
  await recordAudit(exec, {
    familyId: invitation.familyId,
    actorUserId: userId,
    action: "invitation.accepted",
    entityType: "invitation",
    entityId: invitation.id
  });
}

export async function listPendingInvitations(exec: Executor, actor: Actor) {
  if (actor.familyRole !== "admin") throw errors.forbidden();
  return exec
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.familyRole,
      createdAt: invitations.createdAt,
      expiresAt: invitations.expiresAt
    })
    .from(invitations)
    .where(and(eq(invitations.familyId, actor.familyId), isNull(invitations.acceptedAt)))
    .orderBy(desc(invitations.createdAt));
}

export async function revokeInvitation(
  exec: Executor,
  actor: Actor,
  invitationId: string
): Promise<void> {
  if (actor.familyRole !== "admin") throw errors.forbidden();
  const removed = await exec
    .delete(invitations)
    .where(and(eq(invitations.id, invitationId), eq(invitations.familyId, actor.familyId)))
    .returning({ id: invitations.id });
  if (!removed.length) throw errors.notFound("Invitation");
  await recordAudit(exec, {
    familyId: actor.familyId,
    actorUserId: actor.userId,
    action: "invitation.revoked",
    entityType: "invitation",
    entityId: invitationId
  });
}
