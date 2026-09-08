export interface SafeDbConfig {
  dbName: string;
  adminUrl: string;
  testUrl: string;
  quotedDbName: string;
}

export function normalizeDbUrl(rawUrl: string): { host: string; port: string; dbName: string } {
  const url = new URL(rawUrl);
  let host = url.hostname.toLowerCase();
  if (host === "localhost" || host === "::1") {
    host = "127.0.0.1";
  }
  const port = url.port || "5432";
  const dbName = url.pathname.replace(/^\//, "").trim();
  return { host, port, dbName };
}

export function quoteIdentifier(identifier: string): string {
  if (!/^[a-zA-Z0-9_]{1,63}$/.test(identifier)) {
    throw new Error(`Invalid PostgreSQL identifier: "${identifier}"`);
  }
  return `"${identifier.replace(/"/g, '""')}"`;
}

export function assertSafeTestDatabase(
  testUrl: string | undefined,
  appUrl?: string | undefined
): SafeDbConfig {
  if (!testUrl || !testUrl.trim()) {
    throw new Error(
      "TEST_DATABASE_URL is required for database tests. Refusing to run tests against application or fallback database."
    );
  }

  let parsedTestUrl: URL;
  try {
    parsedTestUrl = new URL(testUrl);
  } catch {
    throw new Error(`Invalid TEST_DATABASE_URL format: "${testUrl}"`);
  }

  const { host: testHost, port: testPort, dbName } = normalizeDbUrl(testUrl);

  if (!dbName) {
    throw new Error("TEST_DATABASE_URL must specify a database name.");
  }

  if (!/^[a-zA-Z0-9_]{1,63}$/.test(dbName)) {
    throw new Error(
      `TEST_DATABASE_URL database name "${dbName}" is invalid. Must be 1-63 alphanumeric or underscore characters.`
    );
  }

  const forbidden = new Set(["postgres", "template0", "template1"]);
  if (forbidden.has(dbName.toLowerCase())) {
    throw new Error(`TEST_DATABASE_URL cannot target system database "${dbName}".`);
  }

  const isTestNamed = /(?:^|[_-])test(?:[_-]|$)|review/i.test(dbName);
  if (!isTestNamed) {
    throw new Error(
      `TEST_DATABASE_URL database name "${dbName}" must explicitly designate a test database (e.g. containing "test" or "review").`
    );
  }

  if (appUrl && appUrl.trim()) {
    try {
      const { host: appHost, port: appPort, dbName: appDbName } = normalizeDbUrl(appUrl);
      if (
        testHost === appHost &&
        testPort === appPort &&
        dbName.toLowerCase() === appDbName.toLowerCase()
      ) {
        throw new Error(
          `CRITICAL: TEST_DATABASE_URL targets the same database ("${dbName}") as the application DATABASE_URL. Refusing to run tests.`
        );
      }
    } catch (e: any) {
      if (e.message && e.message.startsWith("CRITICAL:")) throw e;
    }
  }

  const auth = parsedTestUrl.password
    ? `${parsedTestUrl.username}:${parsedTestUrl.password}`
    : parsedTestUrl.username;
  const adminUrl = `${parsedTestUrl.protocol}//${auth ? `${auth}@` : ""}${parsedTestUrl.hostname}${parsedTestUrl.port ? `:${parsedTestUrl.port}` : ""}/postgres`;

  return {
    dbName,
    adminUrl,
    testUrl: parsedTestUrl.href,
    quotedDbName: quoteIdentifier(dbName)
  };
}
