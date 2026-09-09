import { describe, expect, it, afterEach } from "vitest";
import { mailFromAddress, createMailer, ConsoleMailer } from "@/server/security/mailer";
import { env } from "@/lib/env";

const originalTransport = env.MAIL_TRANSPORT;
const originalSmtpUrl = env.SMTP_URL;
const originalNodeEnv = env.NODE_ENV;
const originalMailFrom = env.MAIL_FROM;
const originalAuthMode = env.AUTH_MODE;

afterEach(() => {
  (env as Record<string, unknown>).MAIL_TRANSPORT = originalTransport;
  (env as Record<string, unknown>).SMTP_URL = originalSmtpUrl;
  (env as Record<string, unknown>).NODE_ENV = originalNodeEnv;
  (env as Record<string, unknown>).MAIL_FROM = originalMailFrom;
  (env as Record<string, unknown>).AUTH_MODE = originalAuthMode;
});

describe("mailFromAddress", () => {
  it("falls back to the APP_URL hostname", () => {
    expect(mailFromAddress()).toMatch(/^no-reply@/);
  });
});

describe("createMailer", () => {
  it("refuses manual invitations for password-based authentication", () => {
    env.MAIL_TRANSPORT = "manual";
    env.AUTH_MODE = "password";
    expect(() => createMailer()).toThrow(/require Cloudflare Access/);
  });

  it("never silently discards an email in manual invitation mode", async () => {
    env.MAIL_TRANSPORT = "manual";
    env.AUTH_MODE = "cloudflare-access";
    await expect(
      createMailer().send({ to: "test@example.test", subject: "Test", text: "Test" })
    ).rejects.toThrow(/Outbound email is disabled/);
  });
  it("returns ConsoleMailer by default", () => {
    (env as Record<string, unknown>).MAIL_TRANSPORT = "console";
    const mailer = createMailer();
    expect(mailer).toBeInstanceOf(ConsoleMailer);
  });

  it("throws error when MAIL_TRANSPORT is smtp but SMTP_URL is missing", () => {
    (env as Record<string, unknown>).MAIL_TRANSPORT = "smtp";
    (env as Record<string, unknown>).SMTP_URL = undefined;
    expect(() => createMailer()).toThrowError(
      /MAIL_TRANSPORT is set to 'smtp' but SMTP_URL is not configured/
    );
  });

  it("refuses console transport in production", () => {
    (env as Record<string, unknown>).MAIL_TRANSPORT = "console";
    (env as Record<string, unknown>).NODE_ENV = "production";
    expect(() => createMailer()).toThrowError(/must be 'smtp' in production/);
  });

  it("requires MAIL_FROM for smtp in production", () => {
    (env as Record<string, unknown>).MAIL_TRANSPORT = "smtp";
    (env as Record<string, unknown>).SMTP_URL = "smtp://user:pass@smtp.example.test:587";
    (env as Record<string, unknown>).NODE_ENV = "production";
    (env as Record<string, unknown>).MAIL_FROM = undefined;
    expect(() => createMailer()).toThrowError(/MAIL_FROM must be set/);
  });

  it("accepts fully configured smtp in production", () => {
    (env as Record<string, unknown>).MAIL_TRANSPORT = "smtp";
    (env as Record<string, unknown>).SMTP_URL = "smtp://user:pass@smtp.example.test:587";
    (env as Record<string, unknown>).NODE_ENV = "production";
    (env as Record<string, unknown>).MAIL_FROM = "no-reply@example.test";
    expect(() => createMailer()).not.toThrow();
  });
});
