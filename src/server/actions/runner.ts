import { ZodError } from "zod";
import { DomainError, isRedirectSignal } from "@/lib/errors";
import { log, redactDeep } from "@/lib/logger";

export type ActionState<T = void> =
  { ok: true; data?: T } | { ok: false; error: string; code?: string };

export async function runAction<T>(
  name: string,
  fn: () => Promise<T>
): Promise<ActionState<Awaited<T>>> {
  try {
    const data = await fn();
    log.info({ action: name }, "action.completed");
    return { ok: true, data: data as Awaited<T> };
  } catch (e) {
    if (isRedirectSignal(e)) throw e;
    if (e instanceof DomainError) {
      log.warn({ action: name, code: e.code }, "action.rejected");
      return { ok: false, error: e.userMessage, code: e.code };
    }
    if (e instanceof ZodError) {
      const first = e.issues[0];
      const field = first?.path?.join(".");
      log.warn({ action: name }, "action.invalid_input");
      return {
        ok: false,
        error: field ? `${field}: ${first!.message}` : "Invalid input.",
        code: "validation.failed"
      };
    }
    log.error({ action: name, err: redactDeep(e) }, "action.failed");
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export function formValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

export function optionalString(value: string | undefined): string | null {
  if (value === undefined || value.trim() === "") return null;
  return value.trim();
}
