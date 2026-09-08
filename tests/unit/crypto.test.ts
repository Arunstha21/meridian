import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  passwordPolicyError,
  hashToken,
  randomToken
} from "@/lib/crypto";
import { redactDeep } from "@/lib/logger";

describe("password crypto", () => {
  it("hashes and verifies passwords", async () => {
    const hash = await hashPassword("CorrectHorse1");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword(hash, "CorrectHorse1")).toBe(true);
    expect(await verifyPassword(hash, "wrong")).toBe(false);
  });

  it("produces unique salts", async () => {
    const a = await hashPassword("SameInput1");
    const b = await hashPassword("SameInput1");
    expect(a).not.toBe(b);
  });

  it("rejects malformed stored hashes safely", async () => {
    expect(await verifyPassword("garbage", "x")).toBe(false);
    expect(await verifyPassword("scrypt$a$b$c$d$e", "x")).toBe(false);
  });

  it("enforces password policy", () => {
    expect(passwordPolicyError("short1")).toBeTruthy();
    expect(passwordPolicyError("onlyletterspassword")).toBeTruthy();
    expect(passwordPolicyError("12345678901")).toBeTruthy();
    expect(passwordPolicyError("GoodPass123")).toBeNull();
  });
});

describe("token handling", () => {
  it("hashes tokens deterministically without storing raw values", () => {
    const token = randomToken();
    expect(token).not.toContain("=");
    expect(hashToken(token)).toHaveLength(64);
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(randomToken())).not.toBe(hashToken(token));
  });
});

describe("redaction", () => {
  it("removes sensitive keys recursively", () => {
    const out = redactDeep({
      password: "hunter2",
      nested: { api_key: "xyz", safe: "value" },
      list: [{ authorization: "Bearer abc" }]
    }) as Record<string, unknown>;
    expect(out.password).toBe("[redacted]");
    const nested = out.nested as Record<string, unknown>;
    expect(nested.api_key).toBe("[redacted]");
    expect(nested.safe).toBe("value");
    const list = out.list as Array<Record<string, unknown>>;
    expect(list[0]!.authorization).toBe("[redacted]");
  });

  it("keeps error metadata minimal", () => {
    const out = redactDeep(new Error("boom")) as { name: string; message: string };
    expect(out.name).toBe("Error");
    expect(out.message).toBe("boom");
  });
});
