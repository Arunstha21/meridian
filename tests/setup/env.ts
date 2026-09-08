import { config } from "dotenv";
import { assertSafeTestDatabase } from "./database-guard";

// Source the test environment configuration
config({ path: ".env.test", quiet: true });

const env = process.env as Record<string, string | undefined>;
env.NODE_ENV = "test";

const testUrl = process.env.TEST_DATABASE_URL;
const appUrl = process.env.APP_DATABASE_URL;

if (testUrl && testUrl.trim()) {
  const safeConfig = assertSafeTestDatabase(testUrl, appUrl);
  // Unconditionally route EVERY database client, migration, and query to the isolated test database
  process.env.DATABASE_URL = safeConfig.testUrl;
  process.env.TEST_DATABASE_URL = safeConfig.testUrl;
} else {
  // Never leave DATABASE_URL pointing to an application database during tests
  delete process.env.DATABASE_URL;
}
