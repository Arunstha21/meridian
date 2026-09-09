import nodemailer, { Transporter } from "nodemailer";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";

export function mailFromAddress(): string {
  if (env.MAIL_FROM) return env.MAIL_FROM;
  try {
    return `no-reply@${new URL(env.APP_URL).hostname}`;
  } catch {
    return "no-reply@localhost";
  }
}

export interface MailInput {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(input: MailInput): Promise<void>;
}

export class ConsoleMailer implements Mailer {
  async send(input: MailInput): Promise<void> {
    log.info(
      {
        to: input.to,
        subject: input.subject,
        text: env.NODE_ENV === "production" ? "[redacted]" : input.text
      },
      "mail.console_delivery"
    );
  }
}

export class SmtpMailer implements Mailer {
  private transporter: Transporter;

  constructor(url: string) {
    this.transporter = nodemailer.createTransport({ url });
  }

  async send(input: MailInput): Promise<void> {
    await this.transporter.sendMail({
      from: mailFromAddress(),
      to: input.to,
      subject: input.subject,
      text: input.text
    });
  }
}

/**
 * Returns a human-readable description when mail is not configured safely
 * for the current environment, or null when it is. Production must use a
 * real SMTP transport with an explicit sender: console delivery silently
 * swallows verification, password-reset, and invitation emails and is never
 * production-ready.
 */
export function mailConfigurationIssue(): string | null {
  if (env.MAIL_TRANSPORT === "manual") {
    return env.AUTH_MODE === "cloudflare-access"
      ? null
      : "Manual invitations require Cloudflare Access authentication.";
  }
  const isProduction = env.NODE_ENV === "production";
  if (env.MAIL_TRANSPORT !== "smtp") {
    if (isProduction) {
      return "MAIL_TRANSPORT must be 'smtp' in production. Console delivery is not production-ready.";
    }
    return null;
  }
  if (!env.SMTP_URL) {
    return "MAIL_TRANSPORT is set to 'smtp' but SMTP_URL is not configured.";
  }
  if (isProduction && !env.MAIL_FROM) {
    return "MAIL_FROM must be set when MAIL_TRANSPORT=smtp in production so the sender identity is explicit.";
  }
  return null;
}

export function createMailer(): Mailer {
  const issue = mailConfigurationIssue();
  if (issue) throw new Error(`Refusing to start mailer: ${issue}`);
  if (env.MAIL_TRANSPORT === "manual") {
    return {
      async send() {
        throw new Error("Outbound email is disabled; share an invitation link instead.");
      }
    };
  }
  if (env.MAIL_TRANSPORT === "smtp") return new SmtpMailer(env.SMTP_URL!);
  return new ConsoleMailer();
}
