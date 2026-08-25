import { redirect } from "next/navigation";
import { loadActor } from "@/server/auth/context";
import { Card } from "@/components/ds/card";
import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in" };

export default async function SignInPage() {
  const actor = await loadActor();
  if (actor) redirect("/");
  return (
    <Card>
      <h1 className="mb-4 text-lg font-semibold">Sign in</h1>
      <SignInForm />
    </Card>
  );
}
