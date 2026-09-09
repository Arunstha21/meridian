import { requireVerifiedActor } from "@/server/auth/context";
import { getDb } from "@/server/db/client";
import { listSessionsForActor } from "@/server/domain/users";
import { revokeSessionAction, revokeOtherSessionsAction } from "@/app/(app)/settings/actions";
import { Card, PageHeader, Badge } from "@/components/ds/card";
import { SubmitButton } from "@/components/ds/submit-button";

export const metadata = { title: "Security" };

export default async function SecurityPage() {
  const actor = await requireVerifiedActor();
  if (actor.authProvider === "cloudflare-access") {
    return (
      <>
        <PageHeader title="Security" subtitle="Sign-in is managed by Cloudflare Access." />
        <Card>
          <p className="text-sm text-muted-foreground">
            Use an email code or Google to sign in. Your operator can revoke device sessions in
            Cloudflare Access.
          </p>
          <a href="/cdn-cgi/access/logout" className="mt-4 inline-block underline">
            Sign out of this device
          </a>
        </Card>
      </>
    );
  }
  const db = getDb();
  const sessions = await listSessionsForActor(db, actor);

  return (
    <>
      <PageHeader
        title="Security"
        subtitle="Review active sessions and sign out devices you no longer use."
        actions={
          <form action={revokeOtherSessionsAction}>
            <SubmitButton variant="secondary">Sign out other sessions</SubmitButton>
          </form>
        }
      />

      <Card>
        <ul className="divide-y divide-border">
          {sessions.map((s) => {
            const isCurrent = s.id === actor.sessionId;
            return (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    Session {s.id.slice(0, 8)}…{" "}
                    {isCurrent ? <Badge tone="success">this device</Badge> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Last used{" "}
                    {new Intl.DateTimeFormat("en", {
                      dateStyle: "medium",
                      timeStyle: "short"
                    }).format(s.lastUsedAt)}
                    {s.ip ? ` · ${s.ip}` : ""}
                    {s.userAgent ? ` · ${s.userAgent.slice(0, 60)}` : ""}
                  </p>
                </div>
                {!isCurrent ? (
                  <form action={revokeSessionAction}>
                    <input type="hidden" name="sessionId" value={s.id} />
                    <SubmitButton variant="secondary">Revoke</SubmitButton>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <h2 className="text-base font-medium text-primary">What we protect</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Passwords are hashed with scrypt; session tokens are stored hashed.</li>
          <li>Sessions expire after 30 days of inactivity and can be revoked instantly.</li>
          <li>Login attempts are rate-limited per account and IP address.</li>
          <li>Every sensitive action is written to an audit trail.</li>
        </ul>
      </Card>
    </>
  );
}
