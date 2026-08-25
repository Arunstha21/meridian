import nodemailer, { Transporter } from "nodemailer";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";

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
    log.info({ to: input.to, subject: input.subject }, "mail.console_delivery");
    console.log(`--- email to ${input.to} ---\n${input.text}\n---`);
  }
}

class SmtpMailer implements Mailer {
  private transporter: Transporter;

  constructor(url: string) {
    this.transporter = nodemailer.createTransport({ url });
  }

  async send(input: MailInput): Promise<void> {
    await this.transporter.sendMail({
      from: env.APP_URL.replace(/^https?:\/\//, "no-reply@"),
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
