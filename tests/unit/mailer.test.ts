import { describe, expect, it } from "vitest";
import { mailFromAddress } from "@/server/security/mailer";

describe("mailFromAddress", () => {
  it("falls back to the APP_URL hostname", () => {
    expect(mailFromAddress()).toMatch(/^no-reply@/);
  });
});
