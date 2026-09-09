import { redirect } from "next/navigation";
import { loadActor, loadAccessIdentity } from "@/server/auth/context";
import { usesCloudflareAccess } from "@/server/auth/access";
import { AccessHouseholdForm } from "./access-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "./sign-up-form";

export const metadata = { title: "Create your account" };

export default async function SignUpPage() {
  const actor = await loadActor();
  if (actor) redirect("/");
  if (usesCloudflareAccess()) {
    const identity = await loadAccessIdentity();
    if (!identity) redirect("/sign-in");
    return (
      <AuthShell
        title="Set up your household"
        subtitle="Your email is verified. Choose how to organize your ledger."
      >
        <AccessHouseholdForm email={identity.email} />
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Create your account" subtitle="Start a household ledger in a few minutes">
      <SignUpForm />
    </AuthShell>
  );
}
