import { redirect } from "next/navigation";
import { loadActor } from "@/server/auth/context";
import { Card } from "@/components/ds/card";
import { SignUpForm } from "./sign-up-form";

export const metadata = { title: "Create your account" };

export default async function SignUpPage() {
  const actor = await loadActor();
  if (actor) redirect("/");
  return (
    <Card>
      <h1 className="mb-4 text-lg font-semibold">Create your account</h1>
      <SignUpForm />
    </Card>
  );
}
