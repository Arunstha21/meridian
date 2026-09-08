import { redirect } from "next/navigation";
import { loadActor } from "@/server/auth/context";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in" };

export default async function SignInPage() {
  const actor = await loadActor();
  if (actor) redirect("/");
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your Meridian household">
      <SignInForm />
    </AuthShell>
  );
}
