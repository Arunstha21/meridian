import { Card } from "@/components/ds/card";
import { ForgotPasswordForm } from "./forgot-form";
import { redirect } from "next/navigation";
import { usesCloudflareAccess } from "@/server/auth/access";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  if (usesCloudflareAccess()) redirect("/sign-in");
  return (
    <Card>
      <h1 className="mb-1 text-lg font-semibold">Reset your password</h1>
      <p className="mb-4 text-sm text-muted-foreground">We will email you a one-time reset link.</p>
      <ForgotPasswordForm />
    </Card>
  );
}
