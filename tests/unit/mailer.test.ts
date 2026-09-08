import { describe, expect, it, afterEach } from "vitest";
import { mailFromAddress, createMailer, ConsoleMailer } from "@/server/security/mailer";
import { env } from "@/lib/env";

const originalTransport = env.MAIL_TRANSPORT;
const originalSmtpUrl = env.SMTP_URL;

afterEach(() => {
  (env as Record<string, unknown>).MAIL_TRANSPORT = originalTransport;
  (env as Record<string, unknown>).SMTP_URL = originalSmtpUrl;
});

describe("mailFromAddress", () => {
  it("falls back to the APP_URL hostname", () => {
    expect(mailFromAddress()).toMatch(/^no-reply@/);
  });
});

describe("createMailer", () => {
  it("returns ConsoleMailer by default", () => {
    (env as Record<string, unknown>).MAIL_TRANSPORT = "console";
    const mailer = createMailer();
    expect(mailer).toBeInstanceOf(ConsoleMailer);
  });

  it("throws error when MAIL_TRANSPORT is smtp but SMTP_URL is missing", () => {
    (env as Record<string, unknown>).MAIL_TRANSPORT = "smtp";
    (env as Record<string, unknown>).SMTP_URL = undefined;
    expect(() => createMailer()).toThrowError(/MAIL_TRANSPORT is set to 'smtp' but SMTP_URL is not configured/);
  });
});
