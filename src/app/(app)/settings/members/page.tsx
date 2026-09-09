import { requireVerifiedActor } from "@/server/auth/context";
import { env } from "@/lib/env";
import { getDb } from "@/server/db/client";
import { listFamilyMembers } from "@/server/domain/users";
import { listPendingInvitations } from "@/server/domain/invitations";
import { Badge, Card, PageHeader } from "@/components/ds/card";
import { SubmitButton } from "@/components/ds/submit-button";
import { ConfirmDialog } from "@/components/ds/dialog";
import { InviteForm } from "./invite-form";
import { manageMemberAction, revokeInvitationAction } from "@/app/(app)/settings/actions";

export const metadata = { title: "Members" };

export default async function MembersPage() {
  const actor = await requireVerifiedActor();
  const db = getDb();
  const isAdmin = actor.familyRole === "admin";

  if (!isAdmin) {
    const members = await listFamilyMembers(db, actor.familyId);
    return (
      <>
        <PageHeader title="Members" />
        <MemberTable members={members} currentUserId={actor.userId} isAdmin={false} />
      </>
    );
  }

  const [members, pending] = await Promise.all([
    listFamilyMembers(db, actor.familyId),
    listPendingInvitations(db, actor)
  ]);

  return (
    <>
      <PageHeader title="Members" subtitle="Invite people to share your family workspace." />
      <InviteForm manualDelivery={env.MAIL_TRANSPORT === "manual"} />
      <MemberTable members={members} currentUserId={actor.userId} isAdmin={isAdmin} />
      <Card>
        <h2 className="mb-3 text-base font-medium text-primary">Pending invitations</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending invitations.</p>
        ) : (
          <ul className="divide-y divide-border">
            {pending.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <p>{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {inv.role} · expires{" "}
                    {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(inv.expiresAt)}
                  </p>
                </div>
                <form action={revokeInvitationAction}>
                  <input type="hidden" name="invitationId" value={inv.id} />
                  <SubmitButton variant="secondary">Revoke</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

type MemberRow = Awaited<ReturnType<typeof listFamilyMembers>>[number];

function MemberTable({
  members,
  currentUserId,
  isAdmin
}: {
  members: MemberRow[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  return (
    <Card>
      <ul className="divide-y divide-border">
        {members.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
            <div>
              <p className="font-medium">
                {m.name}
                {m.id === currentUserId ? (
                  <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                ) : null}
              </p>
              <p className="text-xs text-muted-foreground">{m.email}</p>
            </div>
            <div className="flex items-center gap-2">
              {!m.verified ? <Badge tone="warning">unverified</Badge> : null}
              <Badge tone={m.role === "admin" ? "primary" : "neutral"}>{m.role}</Badge>
              {isAdmin && m.id !== currentUserId ? (
                <div className="flex gap-1.5">
                  <form action={manageMemberAction}>
                    <input type="hidden" name="userId" value={m.id} />
                    <input
                      type="hidden"
                      name="op"
                      value={m.role === "admin" ? "demote" : "promote"}
                    />
                    <SubmitButton variant="secondary">
                      {m.role === "admin" ? "Demote" : "Make admin"}
                    </SubmitButton>
                  </form>
                  <ConfirmDialog
                    trigger={
                      <span className="inline-flex rounded-lg bg-destructive px-3.5 py-2 text-sm font-medium text-white">
                        Remove
                      </span>
                    }
                    title={`Remove ${m.name}?`}
                    description="They will immediately lose access. Their accounts and every transaction they recorded stay preserved in the ledger."
                    confirmLabel="Remove member"
                    action={manageMemberAction}
                  >
                    <input type="hidden" name="userId" value={m.id} />
                    <input type="hidden" name="op" value="remove" />
                  </ConfirmDialog>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
