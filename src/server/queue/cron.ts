const FIELD_MAX = [59, 23, 31, 12, 6];
const FIELD_MIN = [0, 0, 1, 1, 0];

export function isValidCron(expr: string): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  return parts.every((part, i) => {
    const min = FIELD_MIN[i];
    const max = FIELD_MAX[i];
    if (min === undefined || max === undefined) return false;
    return parseField(part, min, max) !== null;
  });
}

type Field = { values: Set<number>; wildcard: boolean };

function parseField(spec: string, min: number, max: number): Field | null {
  const values = new Set<number>();
  let wildcard = false;
  for (const part of spec.split(",")) {
    const stepMatch = part.match(/^\*\/(\d+)$/);
    if (stepMatch) {
      const step = Number(stepMatch[1]);
      if (!step || step > max - min + 1) return null;
      for (let v = min; v <= max; v += step) values.add(v);
      continue;
    }
    const rangeMatch = part.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const a = Number(rangeMatch[1]);
      const b = Number(rangeMatch[2]);
      if (a < min || b > max || a > b) return null;
      for (let v = a; v <= b; v++) values.add(v);
      continue;
    }
    if (part === "*") {
      wildcard = true;
      for (let v = min; v <= max; v++) values.add(v);
      continue;
    }
    if (!/^\d+$/.test(part)) return null;
    const v = Number(part);
    if (v < min || v > max) return null;
    values.add(v);
  }
  return { values, wildcard };
}

export function nextCronRun(expr: string, after: Date): Date {
  if (!isValidCron(expr)) throw new Error(`Invalid cron expression: ${expr}`);
  const specs = expr.trim().split(/\s+/);
  const fields = specs.map((p, i) => {
    const min = FIELD_MIN[i];
    const max = FIELD_MAX[i];
    if (min === undefined || max === undefined) {
      throw new Error(`Invalid field index: ${i}`);
    }
    return parseField(p, min, max);
  });
  const [minuteF, hourF, domF, monthF, dowF] = fields as [Field, Field, Field, Field, Field];

  const d = new Date(after.getTime());
  d.setUTCSeconds(0, 0);
  d.setUTCMinutes(d.getUTCMinutes() + 1);

  const limit = 366 * 24 * 60;
  for (let i = 0; i < limit; i++) {
    const domRestricted = !domF.wildcard;
    const dowRestricted = !dowF.wildcard;
    let dayOk: boolean;
    if (!domRestricted && !dowRestricted) {
      dayOk = true;
    } else if (domRestricted && dowRestricted) {
      dayOk = domF.values.has(d.getUTCDate()) || dowF.values.has(d.getUTCDay());
    } else {
      dayOk =
        (domRestricted ? domF.values.has(d.getUTCDate()) : true) &&
        (dowRestricted ? dowF.values.has(d.getUTCDay()) : true);
    }
    if (
      minuteF.values.has(d.getUTCMinutes()) &&
      hourF.values.has(d.getUTCHours()) &&
      monthF.values.has(d.getUTCMonth() + 1) &&
      dayOk
    ) {
      return d;
    }
    d.setUTCMinutes(d.getUTCMinutes() + 1);
  }
  throw new Error(`Could not compute next run for cron: ${expr}`);
}
