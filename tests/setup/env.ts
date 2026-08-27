import { config } from "dotenv";

// Vitest does not load .env.local; source the project's env files explicitly
// before anything reads process.env.
config({ path: ".env.test", quiet: true });
config({ path: ".env.local", quiet: true });

const env = process.env as Record<string, string | undefined>;
env.NODE_ENV = env.NODE_ENV ?? "test";
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ?? "postgres://localhost:5432/meridian_test";
}
