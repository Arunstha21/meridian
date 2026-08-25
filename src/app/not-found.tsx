import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="text-center space-y-3">
        <p className="text-4xl font-semibold">404</p>
        <p className="text-muted">That page does not exist.</p>
        <Link href="/" className="text-primary underline underline-offset-4">
          Back home
        </Link>
      </div>
    </main>
  );
}
