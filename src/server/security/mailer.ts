import nodemailer, { Transporter } from "nodemailer";
import { env, isProd } from "@/lib/env";
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

class ConsoleMailer implements Mailer {
  async send(input: MailInput): Promise<void> {
    log.info(
      { to: input.to, subject: input.subject, text: isProd ? "[redacted]" : input.text },
      "mail.console_delivery"
    );
  }
}

class SmtpMailer implements Mailer {
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

export function createMailer(): Mailer {
  if (env.MAIL_TRANSPORT === "smtp" && env.SMTP_URL) {
    return new SmtpMailer(env.SMTP_URL);
  }
  return new ConsoleMailer();
}
