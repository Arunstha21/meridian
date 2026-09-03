const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): value is IsoDate {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export type IsoDate = string & { readonly __isoDate: unique symbol };

export function todayIn(tz: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

export function addDays(iso: string, days: number): string {
  assertIso(iso);
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string): number {
  assertIso(a);
  assertIso(b);
  const da = new Date(`${a}T00:00:00Z`).getTime();
  const db = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((da - db) / 86_400_000);
}

export function minDate(a: string, b: string): string {
  return a <= b ? a : b;
}

export function maxDate(a: string, b: string): string {
  return a >= b ? a : b;
}

export function monthKeyIn(tz: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit"
  }).format(now);
}

export function monthKeyOf(iso: string): string {
  assertIso(iso);
  return iso.slice(0, 7);
}

export function startOfMonth(iso: string): string {
  assertIso(iso);
  return `${iso.slice(0, 7)}-01`;
}

export function endOfMonth(iso: string): string {
  assertIso(iso);
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const last = new Date(Date.UTC(y, m, 0));
  return last.toISOString().slice(0, 10);
}

export function addMonths(monthKey: string, delta: number): string {
  const y = Number(monthKey.slice(0, 4));
  const m = Number(monthKey.slice(5, 7));
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function dateRange(from: string, to: string): string[] {
  assertIso(from);
  assertIso(to);
  const out: string[] = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function formatIsoDate(iso: string, locale = "en", tz?: string): string {
  assertIso(iso);
  return new Intl.DateTimeFormat(locale, {
    ...(tz ? { timeZone: tz } : {}),
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(new Date(`${iso}T00:00:00Z`));
}

export function formatMonthKey(key: string, locale = "en"): string {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${key}-01T00:00:00Z`)
  );
}

function assertIso(value: string): void {
  if (!isIsoDate(value)) {
    throw new Error(`Invalid ISO date: "${value}"`);
  }
}
