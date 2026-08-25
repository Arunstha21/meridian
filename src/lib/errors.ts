export class DomainError extends Error {
  readonly code: string;
  readonly userMessage: string;
  readonly status: number;
  readonly meta?: Record<string, unknown>;

  constructor(
    code: string,
    userMessage: string,
    opts: { status?: number; cause?: unknown; meta?: Record<string, unknown> } = {}
  ) {
    super(userMessage, { cause: opts.cause });
    this.name = "DomainError";
    this.code = code;
    this.userMessage = userMessage;
    this.status = opts.status ?? 400;
    this.meta = opts.meta;
  }
}

export const errors = {
  validation: (message: string, meta?: Record<string, unknown>) =>
    new DomainError("validation.failed", message, { status: 422, meta }),
  unauthorized: () =>
    new DomainError("auth.required", "Please sign in to continue.", { status: 401 }),
  forbidden: (message = "You do not have access to perform that action.") =>
    new DomainError("access.denied", message, { status: 403 }),
  notFound: (what = "Resource") =>
    new DomainError("resource.not_found", `${what} was not found.`, { status: 404 }),
  conflict: (message: string) => new DomainError("conflict", message, { status: 409 }),
  money: (message: string) => new DomainError("money.invalid", message, { status: 422 }),
  rateLimited: (message = "Too many attempts. Please try again later.") =>
    new DomainError("rate.limited", message, { status: 429 })
};

export function isDomainError(e: unknown): e is DomainError {
  return e instanceof DomainError;
}

export function isRedirectSignal(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "digest" in e &&
    typeof (e as { digest?: unknown }).digest === "string" &&
    ((e as { digest: string }).digest.startsWith("NEXT_REDIRECT") ||
      (e as { digest: string }).digest.startsWith("NEXT_NOT_FOUND"))
  );
}
