import "dotenv/config";
import { migrateDownStep, migrateStatusReport, migrateUp } from "../src/server/db/migrate";

const direction = process.argv[2] ?? "up";

async function main() {
  if (direction === "status") {
    const report = await migrateStatusReport();
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (direction === "down") {
    const reverted = await migrateDownStep();
    console.log(reverted ? `Reverted ${reverted}` : "Nothing to revert");
    return;
  }
  const ran = await migrateUp();
  console.log(ran.length ? `Applied:\n${ran.map((m) => `  ${m}`).join("\n")}` : "Database is up to date");
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
