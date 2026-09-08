import { describe, it, expect } from "vitest";
import {
  assertSafeTestDatabase,
  normalizeDbUrl,
  quoteIdentifier
} from "../setup/database-guard";

describe("database-guard (S07 safety)", () => {
  it("rejects absent or empty TEST_DATABASE_URL", () => {
    expect(() => assertSafeTestDatabase(undefined)).toThrow(
      "TEST_DATABASE_URL is required for database tests"
    );
    expect(() => assertSafeTestDatabase("")).toThrow(
      "TEST_DATABASE_URL is required for database tests"
    );
    expect(() => assertSafeTestDatabase("   ")).toThrow(
      "TEST_DATABASE_URL is required for database tests"
    );
  });

  it("rejects invalid URL formats", () => {
    expect(() => assertSafeTestDatabase("not-a-valid-url")).toThrow(
      "Invalid TEST_DATABASE_URL format"
    );
  });

  it("rejects URLs without database names", () => {
    expect(() => assertSafeTestDatabase("postgres://user:pass@localhost:5432/")).toThrow(
      "TEST_DATABASE_URL must specify a database name"
    );
  });

  it("rejects malformed database names or potential SQL injection", () => {
    expect(() =>
      assertSafeTestDatabase("postgres://localhost:5432/test_db;DROP TABLE users;--")
    ).toThrow("is invalid");

    expect(() =>
      assertSafeTestDatabase('postgres://localhost:5432/test"db')
    ).toThrow("is invalid");

    expect(() =>
      assertSafeTestDatabase("postgres://localhost:5432/test space")
    ).toThrow("is invalid");
  });

  it("rejects system or template database names", () => {
    expect(() => assertSafeTestDatabase("postgres://localhost:5432/postgres")).toThrow(
      'cannot target system database "postgres"'
    );
    expect(() => assertSafeTestDatabase("postgres://localhost:5432/template1")).toThrow(
      'cannot target system database "template1"'
    );
  });

  it("rejects database names without a test or review designation", () => {
    expect(() => assertSafeTestDatabase("postgres://localhost:5432/meridian_prod")).toThrow(
      'must explicitly designate a test database (e.g. containing "test" or "review")'
    );
    expect(() => assertSafeTestDatabase("postgres://localhost:5432/production")).toThrow(
      'must explicitly designate a test database'
    );
    expect(() => assertSafeTestDatabase("postgres://localhost:5432/meridian")).toThrow(
      'must explicitly designate a test database'
    );
  });

  it("rejects TEST_DATABASE_URL identical to application DATABASE_URL", () => {
    const testUrl = "postgres://appuser@127.0.0.1:5432/meridian_test";
    const appUrl = "postgres://appuser@localhost:5432/meridian_test";

    expect(() => assertSafeTestDatabase(testUrl, appUrl)).toThrow(
      'targets the same database ("meridian_test") as the application DATABASE_URL'
    );
  });

  it("accepts valid isolated test and review database URLs", () => {
    const validTest = assertSafeTestDatabase(
      "postgres://review_admin@127.0.0.1:55439/meridian_test",
      "postgres://appuser@localhost:5432/meridian"
    );
    expect(validTest.dbName).toBe("meridian_test");
    expect(validTest.quotedDbName).toBe('"meridian_test"');
    expect(validTest.adminUrl).toBe("postgres://review_admin@127.0.0.1:55439/postgres");

    const validReview = assertSafeTestDatabase(
      "postgres://review_admin@127.0.0.1:55439/meridian_review_0123456789abcdef",
      "postgres://appuser@localhost:5432/meridian"
    );
    expect(validReview.dbName).toBe("meridian_review_0123456789abcdef");
    expect(validReview.quotedDbName).toBe('"meridian_review_0123456789abcdef"');
  });

  it("normalizes localhost and 127.0.0.1 when checking URL collisions", () => {
    const normLocal = normalizeDbUrl("postgres://user@localhost:5432/db");
    const normIp = normalizeDbUrl("postgres://user@127.0.0.1:5432/db");
    expect(normLocal.host).toBe("127.0.0.1");
    expect(normIp.host).toBe("127.0.0.1");
    expect(normLocal.port).toBe("5432");
  });

  it("safely quotes identifiers and rejects dangerous ones", () => {
    expect(quoteIdentifier("valid_db_123")).toBe('"valid_db_123"');
    expect(() => quoteIdentifier("bad;name")).toThrow("Invalid PostgreSQL identifier");
  });
});
