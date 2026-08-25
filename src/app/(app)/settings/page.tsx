import { eq } from "drizzle-orm";
import { requireVerifiedActor, currentFamily } from "@/server/auth/context";
import { getDb } from "@/server/db/client";
import { users } from "@/server/db/schema";
import { getUserPrivacyMode } from "@/server/domain/users";
import { Card, PageHeader } from "@/components/ds/card";
import { ProfileForms } from "./forms";
import { OrgForm } from "./org-form";

export const metadata = { title: "Settings" };

const TIMEZONES = [
  "Etc/UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Kathmandu",
  "Asia/Singapore",
  "Australia/Sydney"
];

export default async function SettingsPage() {
  const actor = await requireVerifiedActor();
  const family = await currentFamily(actor);
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, actor.userId)).limit(1);
  const privacy = user ? await getUserPrivacyMode(db, actor.userId) : false;

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-semibold">Profile & preferences</h2>
          <ProfileForms name={actor.name} email={actor.email} timezone={family.timezone} timezones={TIMEZONES} privacy={privacy} />
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold">Organization</h2>
          {actor.familyRole === "admin" ? (
            <OrgForm familyName={family.name} currency={family.currency} locale={family.locale} />
          ) : (
            <p className="text-sm text-muted">
              Only family admins can change organization settings. Ask an admin to update the family
              name, currency or locale.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
