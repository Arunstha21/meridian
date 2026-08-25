import pino from "pino";
import { env } from "./env";

const REDACTED = "[redacted]";

const SENSITIVE_KEYS = new Set([
  "password",
  "current_password",
  "new_password",
  "newpassword",
  "token",
  "access_token",
  "refresh_token",
  "secret",
  "authorization",
  "cookie",
  "api_key",
  "apikey",
  "credentials"
]);

export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

export function redactDeep(value: unknown, depth = 0): Json | undefined {
  if (depth > 6) return undefined;
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((v) => redactDeep(v, depth + 1) ?? null);
  }
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (typeof value === "object") {
    const out: Record<string, Json> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? REDACTED : redactDeep(v, depth + 1) ?? null;
    }
    return out;
  }
  return String(value);
}

export const log = pino({
  level: env.LOG_LEVEL,
  base: { app: "meridian" },
  redact: {
    paths: ["req.headers.cookie", "req.headers.authorization", "*.password", "*.token"],
    censor: REDACTED
  }
});

export function childLogger(bindings: Record<string, Json>) {
  return log.child(bindings);
}

type LogFn = (obj: object, msg?: string) => void;

let actionLogDepth = 0;

export function withActionLogging<T>(
  logger: { info: LogFn; warn: LogFn; error: LogFn },
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  if (actionLogDepth > 0) return fn();
  actionLogDepth++;
  const start = Date.now();
  return fn()
    .then((result) => {
      actionLogDepth--;
      logger.info({ action: name, ms: Date.now() - start }, "action.completed");
      return result;
    })
    .catch((e) => {
      actionLogDepth--;
      if (e instanceof Error && e.name === "DomainError") {
        logger.warn({ action: name, code: (e as { code?: string }).code }, "action.rejected");
      } else {
        logger.error({ action: name, err: redactDeep(e) }, "action.failed");
      }
      throw e;
    });
}
