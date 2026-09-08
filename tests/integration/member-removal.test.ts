import { describe, it, expect, beforeAll } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import {
  db,
  makeUser,
  makeAccount,
  addTxn,
  actorOf,
  joinFamily,
  daysAgo,
  truncateAll
} from "../helpers";
import * as usersSvc from "@/server/domain/users";
import * as invitationsSvc from "@/server/domain/invitations";
import * as accountsSvc from "@/server/domain/accounts";
import * as orchestrate from "@/server/domain/orchestrate";
import { getAccountAccess } from "@/server/authorization/access";
import {
  accountShares,
  accounts,
  auditEvents,
  authTokens,
  entries,
  sessions,
  users
} from "@/server/db/schema";

const MEMBER_PASSWORD = "Sup3rSecure!Pass";

async function addMemberToFamily(familyId: string, email: string) {
  const u = await makeUser({ email });
  await db().execute(
    sql`UPDATE users SET family_id = ${familyId}::uuid, family_role = 'member' WHERE id = ${u.userId}::uuid`
  );
  return { ...u, familyId };
}

beforeAll(async () => {
  await truncateAll();
});

describe("S14: member removal preserves data and revokes access", () => {
  it("deactivates the member and preserves accounts, entries, transfers, and audit", async () => {
    const admin = await makeUser();
    const member = await addMemberToFamily(admin.familyId, "s14-member@example.test");

    const privateAccount = await makeAccount(member, { joint: false, name: "Member Private" });
    const jointAccount = await makeAccount(admin, { joint: true, name: "Family Joint" });

    await addTxn(member, privateAccount, { amountLedgerMinor: 5000, name: "Member expense" });
    await orchestrate.makeTransferWithEntries(db(), actorOf(member), {
      fromAccountId: jointAccount,
      toAccountId: privateAccount,
      date: daysAgo(2),
      amountDisplayMinor: 12000,
      name: "Transfer before removal"
    });
    await accountsSvc.shareAccount(db(), actorOf(member), privateAccount, admin.userId, "read_only");
    const adminPrivateAccount = await makeAccount(admin, { joint: false, name: "Admin Private" });
    await accountsSvc.shareAccount(
      db(),
      actorOf(admin),
      adminPrivateAccount,
      member.userId,
      "read_only"
    );
    // Both explicit shares must grant visibility before removal.
    expect((await getAccountAccess(db(), actorOf(admin), privateAccount)).granted).toBe(true);
    expect((await getAccountAccess(db(), actorOf(member), adminPrivateAccount)).granted).toBe(true);

    await usersSvc.removeMember(db(), actorOf(admin), member.userId);

    const [removedUser] = await db().select().from(users).where(eq(users.id, member.userId));
    expect(removedUser).toBeTruthy();
    expect(removedUser?.removedAt).not.toBeNull();

    // Accounts and ledger data are preserved under the deactivated owner.
    const [accountRow] = await db().select().from(accounts).where(eq(accounts.id, privateAccount));
    expect(accountRow?.ownerId).toBe(member.userId);
    const memberEntries = await db().select().from(entries).where(eq(entries.accountId, privateAccount));
    expect(memberEntries.length).toBeGreaterThan(0);
    const transferCount = await db().execute<{ count: string }>(sql`
      SELECT count(*)::text AS count FROM transfers t
      JOIN entries o ON o.id = t.outflow_entry_id
      JOIN entries i ON i.id = t.inflow_entry_id
      WHERE o.account_id = ${jointAccount}::uuid AND i.account_id = ${privateAccount}::uuid
    `);
    expect(Number((transferCount.rows ?? [])[0]?.count ?? "0")).toBe(1);

    // Access is fully revoked.
    expect(
      await db().select().from(sessions).where(eq(sessions.userId, member.userId))
    ).toHaveLength(0);
    expect(
      await db().select().from(authTokens).where(eq(authTokens.userId, member.userId))
    ).toHaveLength(0);
    expect(
      await db().select().from(accountShares).where(eq(accountShares.userId, member.userId))
    ).toHaveLength(0);
    // Shares on the removed member's owned accounts are revoked too.
    expect(
      await db().select().from(accountShares).where(eq(accountShares.accountId, privateAccount))
    ).toHaveLength(0);
    expect((await getAccountAccess(db(), actorOf(admin), privateAccount)).granted).toBe(false);

    // The member is hidden from the active member list; audit history is kept.
    const listed = await usersSvc.listFamilyMembers(db(), admin.familyId);
    expect(listed.find((m) => m.id === member.userId)).toBeUndefined();
    const audits = await db()
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.action, "member.removed"), eq(auditEvents.entityId, member.userId)));
    expect(audits.length).toBeGreaterThan(0);
  });

  it("blocks sign-in and platform promotion for removed members", async () => {
    const admin = await makeUser();
    const member = await addMemberToFamily(admin.familyId, "s14-blocked@example.test");
    await usersSvc.removeMember(db(), actorOf(admin), member.userId);

    await expect(
      usersSvc.authenticate(db(), { email: member.email, password: MEMBER_PASSWORD }, { ip: null })
    ).rejects.toMatchObject({ code: "access.denied" });

    await expect(usersSvc.grantPlatformAdmin(db(), member.email)).rejects.toMatchObject({
      code: "conflict"
    });

    await expect(
      usersSvc.setMemberRole(db(), actorOf(admin), member.userId, "member")
    ).rejects.toMatchObject({ code: "resource.not_found" });

    await expect(usersSvc.removeMember(db(), actorOf(admin), member.userId)).rejects.toMatchObject({
      code: "conflict"
    });
  });

  it("prevents re-registering a removed member's email but allows re-invite to reactivate", async () => {
    const admin = await makeUser();
    const member = await addMemberToFamily(admin.familyId, "s14-reinvite@example.test");
    await usersSvc.removeMember(db(), actorOf(admin), member.userId);

    await expect(
      usersSvc.registerUserWithFamily(db(), {
        email: member.email,
        password: "TestPassword123!Secure",
        name: "Impostor",
        familyName: "Impostor Family"
      })
    ).rejects.toMatchObject({ code: "conflict" });

    const { token } = await invitationsSvc.createInvitation(db(), actorOf(admin), {
      email: member.email,
      role: "member"
    });
    const accepted = await invitationsSvc.acceptInvitationWithNewAccount(db(), token, {
      name: "Reactivated Member",
      password: "FreshPassword123!Secure"
    });
    expect(accepted.userId).toBe(member.userId);

    const [row] = await db().select().from(users).where(eq(users.id, member.userId));
    expect(row?.removedAt).toBeNull();
    expect(row?.familyId).toBe(admin.familyId);

    const auth = await usersSvc.authenticate(
      db(),
      { email: member.email, password: "FreshPassword123!Secure" },
      { ip: null }
    );
    expect(auth.token).toBeTruthy();
  });

  it("refuses to remove platform admins and non-admins cannot remove members", async () => {
    const admin = await makeUser();
    const superAdmin = await makeUser({ email: "s14-platadmin@example.test" });
    await db().execute(
      sql`UPDATE users SET platform_role = 'super_admin' WHERE id = ${superAdmin.userId}::uuid`
    );
    await joinFamily(superAdmin, admin.familyId);

    await expect(
      usersSvc.removeMember(db(), actorOf(admin), superAdmin.userId)
    ).rejects.toMatchObject({ code: "access.denied" });

    const plain = await addMemberToFamily(admin.familyId, "s14-plain@example.test");
    await expect(
      usersSvc.removeMember(db(), actorOf(plain, "member"), admin.userId)
    ).rejects.toMatchObject({ code: "access.denied" });
  });
});
