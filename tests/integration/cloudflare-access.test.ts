import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, truncateAll } from "../helpers";
import { users, families } from "@/server/db/schema";
import { findAccessUser, registerAccessHousehold } from "@/server/domain/access-users";
import {
  authenticate,
  findUserByEmail,
  performPasswordReset,
  registerUserWithFamily,
  requestPasswordReset
} from "@/server/domain/users";
import { acceptInvitationWithAccess, createInvitation } from "@/server/domain/invitations";
import { actorFromRow } from "@/server/auth/context";

const identity = { subject: "access-owner", email: "access-owner@test.local" };
const household = {
  name: "Owner",
  familyName: "Household",
  currency: "NPR",
  timezone: "Asia/Kathmandu"
};

beforeEach(async () => {
  await truncateAll();
});
afterEach(() => vi.unstubAllEnvs());

describe("Access household accounts", () => {
  it("creates an inbox-verified family admin without a password or platform privileges", async () => {
    vi.stubEnv("AUTH_MODE", "cloudflare-access");
    const user = await registerAccessHousehold(db(), identity, household);
    expect(user).toMatchObject({
      accessSubject: identity.subject,
      passwordHash: "!cloudflare-access",
      familyRole: "admin",
      platformRole: "user"
    });
    expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    const [family] = await db().select().from(families).where(eq(families.id, user.familyId));
    expect(family).toMatchObject({ currency: "NPR", timezone: "Asia/Kathmandu" });
    expect(await findAccessUser(db(), identity)).toMatchObject({ id: user.id });
    expect(await findAccessUser(db(), { ...identity, subject: "other-subject" })).toBeNull();
    expect(await findAccessUser(db(), { ...identity, email: "other@test.local" })).toBeNull();
  });

  it("does not link password accounts or reactivate removed accounts during signup", async () => {
    await registerUserWithFamily(db(), {
      ...household,
      email: identity.email,
      password: "Sup3rSecure!Pass"
    });
    await expect(registerAccessHousehold(db(), identity, household)).rejects.toMatchObject({
      code: "conflict"
    });
    expect(await findAccessUser(db(), identity)).toBeNull();
    await truncateAll();
    const user = await registerAccessHousehold(db(), identity, household);
    await db().update(users).set({ removedAt: new Date() }).where(eq(users.id, user.id));
    expect(await findAccessUser(db(), identity)).toBeNull();
    await expect(registerAccessHousehold(db(), identity, household)).rejects.toMatchObject({
      code: "conflict"
    });
  });

  it("rolls back the new household if the identity is already registered", async () => {
    await registerAccessHousehold(db(), identity, household);
    await expect(
      registerAccessHousehold(db(), { ...identity, email: "second@test.local" }, household)
    ).rejects.toThrow();
    expect(await db().select().from(families)).toHaveLength(1);
    expect(await findUserByEmail(db(), "second@test.local")).toBeNull();
  });

  it("rejects password signup, login, and reset while Access is enabled", async () => {
    vi.stubEnv("AUTH_MODE", "cloudflare-access");
    await expect(
      registerUserWithFamily(db(), {
        ...household,
        email: identity.email,
        password: "Sup3rSecure!Pass"
      })
    ).rejects.toMatchObject({ code: "access.denied" });
    await expect(
      authenticate(db(), { email: identity.email, password: "Sup3rSecure!Pass" }, {})
    ).rejects.toMatchObject({ code: "access.denied" });
    await expect(requestPasswordReset(db(), identity.email)).rejects.toMatchObject({
      code: "access.denied"
    });
    await expect(
      performPasswordReset(db(), "fake-token", "Sup3rSecure!Pass")
    ).rejects.toMatchObject({ code: "access.denied" });
  });

  it("accepts an invitation only for its verified recipient and preserves the subject on rejoin", async () => {
    const owner = await registerAccessHousehold(db(), identity, household);
    const guest = { subject: "access-guest", email: "guest@test.local" };
    const actor = actorFromRow(owner, "");
    const invitation = await createInvitation(db(), actor, { email: guest.email, role: "member" });
    await expect(
      acceptInvitationWithAccess(db(), invitation.token, identity, "Owner")
    ).rejects.toMatchObject({ code: "access.denied" });
    await acceptInvitationWithAccess(db(), invitation.token, guest, "Guest");
    const user = await findAccessUser(db(), guest);
    expect(user).toMatchObject({
      familyId: owner.familyId,
      familyRole: "member",
      platformRole: "user"
    });
    await db().update(users).set({ removedAt: new Date() }).where(eq(users.id, user!.id));
    const reinvite = await createInvitation(db(), actor, { email: guest.email, role: "member" });
    await expect(
      acceptInvitationWithAccess(db(), reinvite.token, { ...guest, subject: "different" }, "Guest")
    ).rejects.toMatchObject({ code: "access.denied" });
    await acceptInvitationWithAccess(db(), reinvite.token, guest, "Guest");
    expect(await findAccessUser(db(), guest)).toMatchObject({ id: user!.id, removedAt: null });
  });
});
