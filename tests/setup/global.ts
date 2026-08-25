import postgres from "postgres";

export default async function globalSetup(): Promise<void> {
  const testUrl = process.env.TEST_DATABASE_URL ?? "postgres://meridian:meridian@localhost:5432/meridian_test";
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = testUrl;
  }

  const url = new URL(testUrl);
  const dbName = url.pathname.replace(/^\//, "");
  const adminUrl = `${url.protocol}//${url.username}:${url.password}@${url.hostname}${url.port ? `:${url.port}` : ""}/postgres`;

  const admin = postgres(adminUrl, { max: 1 });
  try {
    await admin.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await admin.unsafe(`CREATE DATABASE ${dbName}`);
  } finally {
    await admin.end();
  }

  const { migrateUp } = await import("../../src/server/db/migrate");
  await migrateUp();
}
