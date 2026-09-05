import { config } from "dotenv";
import { z } from "zod";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  MAIL_TRANSPORT: z.enum(["console", "smtp"]).default("console"),
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().min(3).optional(),
  ADMIN_EMAILS: z.string().default(""),
  SEED_DEMO: z.enum(["true", "false"]).default("false"),
  SEED_PASSWORD: z.string().optional(),
  DEBUG_LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
  WORKER_POLL_MS: z.coerce.number().int().positive().default(500),
  WORKER_NAME: z.string().optional(),
  REQUIRE_EMAIL_VERIFICATION: z.enum(["true", "false"]).default("false"),
  AI_BASE_URL: z.string().optional(),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  MERO_SHARE_ENCRYPTION_KEY: z
    .string()
    .optional()
    .refine(
      (value) => !value || Buffer.from(value, "base64").length === 32,
      "MERO_SHARE_ENCRYPTION_KEY must be a 32-byte base64 value."
    ),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development")
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";

export function adminEmails(): string[] {
  return env.ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function requireEmailVerification(): boolean {
  return env.REQUIRE_EMAIL_VERIFICATION === "true";
}

export function aiChatEnabled(): boolean {
  return Boolean(env.AI_BASE_URL && env.AI_MODEL);
}
