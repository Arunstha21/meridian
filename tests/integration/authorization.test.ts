import { describe, it, expect, beforeAll } from "vitest";
import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { users } from "@/server/db/schema";
import { db, makeUser, makeAccount, addTxn, truncateAll, actorOf } from "../helpers";
import * as accountsSvc from "@/server/domain/accounts";
import * as entriesSvc from "@/server/domain/entries";
import * as familiesSvc from "@/server/domain/families";
import * as usersSvc from "@/server/domain/users";
import * as valuationsSvc from "@/server/domain/valuations";
import * as recurringSvc from "@/server/domain/recurring";
import * as orchestrate from "@/server/domain/orchestrate";
import { errors } from "@/lib/errors";
import { daysAgo } from "../helpers";

beforeAll(async () => {
  await truncateAll();
});

describe("family tenancy", () => {
  it("denies reading an account of another family", async () => {
    const owner = await makeUser();
    const outsider = await makeUser();
    const accountId = await makeAccount(owner);

    await expect(accountsSvc.getAccountOverview(db(), actorOf(outsider), accountId)).rejects.toMatchObject({
      code: "resource.not_found"
    });
    void accountId;
  });

  it("denies writing to another family's account", async () => {
    const owner = await makeUser();
    const outsider = await makeUser();
    const accountId = await makeAccount(owner);

    await expect(
      entriesSvc.createTransactionEntry(db(), actorOf(outsider), {
        accountId,
        date: daysAgo(1),
        amountLedgerMinor: 100,
        name: "hostile"
      })
    ).rejects.toMatchObject({ code: "resource.not_found" });
  });

  it("super_admin platform role grants no financial access", async () => {
    const owner = await makeUser();
    const admin = await makeUser();
    await db().execute(
      sql`UPDATE users SET platform_role = 'super_admin' WHERE id = ${admin.userId}::uuid`
    );
    const accountId = await makeAccount(owner);
    await expect(accountsSvc.getAccountOverview(db(), actorOf(admin), accountId)).rejects.toMatchObject({
      code: "resource.not_found"
    });
  });
});

describe("account sharing permission matrix", () => {
  it("read_only can view but not annotate", async () => {
    const owner = await makeUser({ familyName: "ShareFam" });
    const member = await makeUser({ email: `member-${Date.now()}@test.local`, familyName: "Other" });

    await joinFamily(member, owner.familyId);
    const accountId = await makeAccount(owner, { joint: false });
    const entryId = await addTxn(owner, accountId, { amountLedgerMinor: 5000, name: "Shared txn" });

    await accountsSvc.shareAccount(db(), actorOf(owner), accountId, member.userId, "read_only");
    await expect(entriesSvc.getEntryDetail(db(), actorOf(member), entryId)).resolves.toBeTruthy();

    await expect(
      entriesSvc.updateTransactionEntry(db(), actorOf(member), entryId, { notes: "annotate attempt" })
    ).rejects.toMatchObject({ code: "access.denied" });
    await expect(
      entriesSvc.updateTransactionEntry(db(), actorOf(member), entryId, { name: "rename" })
    ).rejects.toMatchObject({ code: "access.denied" });
  });

  it("read_write can annotate but not edit core fields or delete", async () => {
    const owner = await makeUser();
    const member = await makeUser({ email: `rw-${Date.now()}@test.local` });
    await joinFamily(member, owner.familyId);

    const accountId = await makeAccount(owner, { joint: false });
    const entryId = await addTxn(owner, accountId, { amountLedgerMinor: 5000, name: "RW txn" });
    await accountsSvc.shareAccount(db(), actorOf(owner), accountId, member.userId, "read_write");

    await entriesSvc.updateTransactionEntry(db(), actorOf(member), entryId, { notes: "annotated by rw" });
    await expect(
      entriesSvc.updateTransactionEntry(db(), actorOf(member), entryId, { amountLedgerMinor: 9999 })
    ).rejects.toMatchObject({ code: "access.denied" });
    await expect(entriesSvc.deleteEntry(db(), actorOf(member), entryId)).rejects.toMatchObject({
      code: "access.denied"
    });
  });

  it("unshared personal accounts are invisible even inside the same family", async () => {
    const owner = await makeUser();
    const colleague = await makeUser({ email: `peer-${Date.now()}@test.local` });
    await joinFamily(colleague, owner.familyId);

    const accountId = await makeAccount(owner, { joint: false });
    await expect(
      entriesSvc.listEntriesPage(db(), actorOf(colleague), {})
    ).resolves.toMatchObject({ items: [] });
    void accountId;
  });

  it("joint accounts are visible and manageable by every family member", async () => {
    const owner = await makeUser();
    const partner = await makeUser({ email: `joint-${Date.now()}@test.local` });
    await joinFamily(partner, owner.familyId);

    const accountId = await makeAccount(owner, { joint: true });
    const overview = await accountsSvc.getAccountOverview(db(), actorOf(partner), accountId);
    expect(overview.level).toBe("full_control");
    expect(overview.isJoint).toBe(true);
  });
});

describe("family lifecycle guards", () => {
  it("blocks removing the last admin", async () => {
    const admin = await makeUser();
    const member = await makeUser({ email: `m2-${Date.now()}@test.local` });
    await joinFamily(member, admin.familyId);

    await expect(usersSvc.setMemberRole(db(), actorOf(admin), admin.userId, "member")).rejects.toBeUndefined;
    await expect(usersSvc.removeMember(db(), actorOf(admin), admin.userId)).rejects.toBeTruthy();
  });

  it("admin-only operations reject plain members", async () => {
    const admin = await makeUser();
    const member = await makeUser({ email: `plain-${Date.now()}@test.local` });
    await joinFamily(member, admin.familyId);

    await expect(familiesSvc.updateFamilySettings(db(), actorOf(member, "member"), { name: "Nope Inc" })).rejects.toMatchObject({
      code: "access.denied"
    });
  });

  it("deleteFamily requires matching confirmation name", async () => {
    const admin = await makeUser();
    await expect(familiesSvc.deleteFamily(db(), actorOf(admin), "wrong-name")).rejects.toMatchObject({
      code: "validation.failed"
    });
    const fam = await familiesSvc.getFamilyById(db(), admin.familyId);
    await familiesSvc.deleteFamily(db(), actorOf(admin), fam!.name);
    const gone = await familiesSvc.getFamilyById(db(), admin.familyId);
    expect(gone).toBeNull();
  });
});

describe("recurring account access", () => {
  it("denies creating or listing series on an unshared personal account", async () => {
    const owner = await makeUser();
    const member = await makeUser({ email: `rec-${Date.now()}@test.local` });
    await joinFamily(member, owner.familyId);
    const accountId = await makeAccount(owner, { joint: false });

    await expect(
      recurringSvc.createSeries(db(), actorOf(member), {
        accountId,
        name: "Rent",
        amountLedgerMinor: 1000,
        frequency: "monthly",
        config: { dayOfMonth: 1 },
        nextDue: daysAgo(0)
      })
    ).rejects.toMatchObject({ code: "resource.not_found" });

    const ownerSeriesId = await recurringSvc.createSeries(db(), actorOf(owner), {
      accountId,
      name: "Rent",
      amountLedgerMinor: 1000,
      frequency: "monthly",
      config: { dayOfMonth: 1 },
      nextDue: daysAgo(0)
    });
    const visible = await recurringSvc.listSeries(db(), actorOf(member));
    expect(visible.map((s) => s.id)).not.toContain(ownerSeriesId);
  });

  it("denies skip/toggle/delete for read_only shares", async () => {
    const owner = await makeUser();
    const member = await makeUser({ email: `rec-ro-${Date.now()}@test.local` });
    await joinFamily(member, owner.familyId);
    const accountId = await makeAccount(owner, { joint: false });
    await accountsSvc.shareAccount(db(), actorOf(owner), accountId, member.userId, "read_only");
    const seriesId = await recurringSvc.createSeries(db(), actorOf(owner), {
      accountId,
      name: "Gym",
      amountLedgerMinor: 4000,
      frequency: "monthly",
      config: { dayOfMonth: 1 },
      nextDue: daysAgo(0)
    });

    const listed = await recurringSvc.listSeries(db(), actorOf(member));
    expect(listed.map((s) => s.id)).toContain(seriesId);

    await expect(recurringSvc.setSeriesActive(db(), actorOf(member), seriesId, false)).rejects.toMatchObject({
      code: "access.denied"
    });
    await expect(recurringSvc.skipNextOccurrence(db(), actorOf(member), seriesId)).rejects.toMatchObject({
      code: "access.denied"
    });
    await expect(recurringSvc.deleteSeries(db(), actorOf(member), seriesId)).rejects.toMatchObject({
      code: "access.denied"
    });
  });
});

describe("transfer unlink access", () => {
  it("denies unlinking when the actor is read_only on a leg", async () => {
    const owner = await makeUser();
    const member = await makeUser({ email: `unlink-${Date.now()}@test.local` });
    await joinFamily(member, owner.familyId);
    const from = await makeAccount(owner, { joint: false });
    const to = await makeAccount(owner, { joint: true });
    await accountsSvc.shareAccount(db(), actorOf(owner), from, member.userId, "read_only");
    const { transferId } = await orchestrate.makeTransferWithEntries(db(), actorOf(owner), {
      fromAccountId: from,
      toAccountId: to,
      date: daysAgo(1),
      amountDisplayMinor: 500
    });
    await expect(orchestrate.unlinkTransfer(db(), actorOf(member), transferId)).rejects.toMatchObject({
      code: "access.denied"
    });
  });
});

describe("valuations access", () => {
  it("requires full control on the account", async () => {
    const owner = await makeUser();
    const member = await makeUser({ email: `val-${Date.now()}@test.local` });
    await joinFamily(member, owner.familyId);
    const accountId = await makeAccount(owner, { type: "other_asset", joint: false });
    await accountsSvc.shareAccount(db(), actorOf(owner), accountId, member.userId, "read_write");

    await expect(
      valuationsSvc.recordValuation(db(), actorOf(member), {
        accountId,
        date: daysAgo(1),
        amountDisplayMinor: 100
      })
    ).rejects.toMatchObject({ code: "access.denied" });
  });
});

describe("member removal privacy (S03)", () => {
  it("deletes private accounts owned by a removed member instead of converting them to joint", async () => {
    const admin = await makeUser({ familyName: "RemovalPrivacyFamily" });
    const member = await makeUser({ email: `removal-${Date.now()}@test.local` });
    await joinFamily(member, admin.familyId);

    const privateAccount = await makeAccount(member, { name: "Member Private", joint: false });
    const jointAccount = await makeAccount(member, { name: "Member Joint", joint: true });

    // Admin removes member
    await usersSvc.removeMember(db(), actorOf(admin, "admin"), member.userId);

    // The private account must have been deleted, not left orphaned with ownerId null
    await expect(accountsSvc.getAccountOverview(db(), actorOf(admin, "admin"), privateAccount)).rejects.toMatchObject({
      code: "resource.not_found"
    });

    // The joint account should remain for the family
    const jointOverview = await accountsSvc.getAccountOverview(db(), actorOf(admin, "admin"), jointAccount);
    expect(jointOverview.account.id).toBe(jointAccount);
  });
});

describe("recurring series authorization (S04)", () => {
  it("denies reassigning recurring series without source or target manage permission", async () => {
    const admin = await makeUser({ familyName: "RecurringAuthFamily" });
    const member = await makeUser({ email: `recur-auth-${Date.now()}@test.local` });
    await joinFamily(member, admin.familyId);

    const adminAccount = await makeAccount(admin, { name: "Admin Checking", joint: false });
    const memberAccount = await makeAccount(member, { name: "Member Checking", joint: false });

    // Admin creates recurring series on admin account
    const seriesId = await recurringSvc.createSeries(db(), actorOf(admin, "admin"), {
      accountId: adminAccount,
      name: "Monthly Gym",
      amountLedgerMinor: 5000,
      frequency: "monthly",
      config: { dayOfMonth: 1 },
      nextDue: "2026-10-01"
    });

    // Member has no access to adminAccount, cannot update or reassign series
    await expect(
      recurringSvc.updateSeries(db(), actorOf(member, "member"), seriesId, {
        accountId: memberAccount
      })
    ).rejects.toMatchObject({ code: "resource.not_found" });

    // If admin shares adminAccount with member as read_only:
    await accountsSvc.shareAccount(db(), actorOf(admin, "admin"), adminAccount, member.userId, "read_only");

    // Member with read_only on source still cannot update or reassign series
    await expect(
      recurringSvc.updateSeries(db(), actorOf(member, "member"), seriesId, {
        accountId: memberAccount
      })
    ).rejects.toMatchObject({ code: "access.denied" });

    // Admin (who has manage on adminAccount) cannot reassign to member's private account without manage permission on memberAccount
    await expect(
      recurringSvc.updateSeries(db(), actorOf(admin, "admin"), seriesId, {
        accountId: memberAccount
      })
    ).rejects.toMatchObject({ code: "resource.not_found" });
  });

  it("denies moving recurring series across accounts with different currencies", async () => {
    const user = await makeUser({ familyName: "RecurringFxFamily" });
    const usdAccount = await makeAccount(user, { name: "USD Account", currency: "USD", joint: true });
    const eurAccount = await makeAccount(user, { name: "EUR Account", currency: "EUR", joint: true });

    const seriesId = await recurringSvc.createSeries(db(), actorOf(user, "admin"), {
      accountId: usdAccount,
      name: "USD Subscription",
      amountLedgerMinor: 1000,
      frequency: "monthly",
      config: { dayOfMonth: 15 },
      nextDue: "2026-10-15"
    });

    await expect(
      recurringSvc.updateSeries(db(), actorOf(user, "admin"), seriesId, {
        accountId: eurAccount
      })
    ).rejects.toMatchObject({ code: "validation.failed" });
  });
});

async function joinFamily(user: Awaited<ReturnType<typeof makeUser>>, familyId: string) {
  await db().update(users).set({ familyId }).where(eq(users.id, user.userId));
  user.familyId = familyId;
}

void errors;
