import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Executor } from "../src/server/db/migrate-types";
import { grantPlatformAdmin, revokePlatformAdmin } from "../src/server/domain/users";
import { verificationUrl } from "../src/server/security/auth-tokens";

async function main() {
  const argv = process.argv.slice(2);
  const demote = argv.includes("--demote");
  const email = argv.find((a) => !a.startsWith("--"))?.trim().toLowerCase();

  if (!email) {
    console.log("Usage: npm run admin:promote -- <email> [--demote]");
    console.log("");
    console.log("Grants platform super_admin to an existing account.");
    console.log("Requires proven inbox ownership (a previously clicked email");
    console.log("verification or password-reset link). If ownership is unproven,");
    console.log("a one-time verification link is issued; re-run after it is used.");
    process.exit(1);
  }

  const db = drizzle(process.env.DATABASE_URL!) as unknown as Executor;

  if (demote) {
    const revoked = await revokePlatformAdmin(db, email);
    console.log(revoked ? `Revoked platform admin from ${email}.` : `${email} is not a platform admin.`);
    return;
  }

  const outcome = await grantPlatformAdmin(db, email);
  if (outcome.status === "already_admin") {
    console.log(`${email} is already a platform admin.`);
  } else if (outcome.status === "verification_required") {
    console.log(`${email} has not proven ownership of that inbox yet.`);
    console.log("A one-time verification link was issued. Ask the account owner to");
    console.log("open it, then re-run this command. Treat the link as a secret:");
    console.log(verificationUrl(outcome.verificationToken));
  } else {
    console.log(`Granted platform super_admin to ${email}.`);
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
);
