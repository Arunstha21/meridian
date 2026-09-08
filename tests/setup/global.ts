import { config } from "dotenv";
import postgres from "postgres";
import { assertSafeTestDatabase } from "./database-guard";

// Vitest globalSetup runs in the main process before worker setupFiles.
// Source .env.test here so TEST_DATABASE_URL is available for test DB provisioning.
config({ path: ".env.test", quiet: true });

export default async function globalSetup(): Promise<void> {
  const testUrl = process.env.TEST_DATABASE_URL;
  const appUrl = process.env.APP_DATABASE_URL;

  if (!testUrl || !testUrl.trim()) {
    // Standalone unit tests without a database configured can proceed
    return;
  }

  const safeConfig = assertSafeTestDatabase(testUrl, appUrl);

  // Unconditionally route migration and all test clients to the isolated test database
  process.env.DATABASE_URL = safeConfig.testUrl;
  process.env.TEST_DATABASE_URL = safeConfig.testUrl;

  const admin = postgres(safeConfig.adminUrl, { max: 1 });
  try {
    await admin.unsafe(`DROP DATABASE IF EXISTS ${safeConfig.quotedDbName} WITH (FORCE)`);
    await admin.unsafe(`CREATE DATABASE ${safeConfig.quotedDbName}`);
  } finally {
    await admin.end();
  }

  const { migrateUp } = await import("../../src/server/db/migrate");
  await migrateUp();

  const { closeDb } = await import("../../src/server/db/client");
  await closeDb();
}
