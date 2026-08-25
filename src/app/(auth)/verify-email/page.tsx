import { loadActor } from "@/server/auth/context";
import { Card } from "@/components/ds/card";
import { VerifyTokenForm, ResendForm } from "./verify-forms";

export const metadata = { title: "Verify your email" };

export default async function VerifyEmailPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const actor = await loadActor();
  return (
    <Card>
      <h1 className="mb-2 text-lg font-semibold">Verify your email address</h1>
      {token ? (
        <VerifyTokenForm token={token} />
      ) : (
        <ResendForm email={actor?.email} />
      )}
    </Card>
  );
}
