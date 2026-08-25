import { Card } from "@/components/ds/card";
import { ResetPasswordForm, InvalidToken } from "./reset-form";

export const metadata = { title: "Reset password" };

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <Card>
      <h1 className="mb-4 text-lg font-semibold">Choose a new password</h1>
      {token ? <ResetPasswordForm token={token} /> : <InvalidToken />}
    </Card>
  );
}
