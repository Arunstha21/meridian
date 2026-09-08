import { redirect } from "next/navigation";
import { loadActor } from "@/server/auth/context";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "./sign-up-form";

export const metadata = { title: "Create your account" };

export default async function SignUpPage() {
  const actor = await loadActor();
  if (actor) redirect("/");
  return (
    <AuthShell title="Create your account" subtitle="Start a household ledger in a few minutes">
      <SignUpForm />
    </AuthShell>
  );
}
