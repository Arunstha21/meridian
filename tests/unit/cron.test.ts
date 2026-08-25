import { describe, it, expect } from "vitest";
import { isValidCron, nextCronRun } from "@/server/queue/cron";

describe("cron parser", () => {
  it("validates expressions", () => {
    expect(isValidCron("* * * * *")).toBe(true);
    expect(isValidCron("*/15 * * * *")).toBe(true);
    expect(isValidCron("17 3 * * *")).toBe(true);
    expect(isValidCron("60 * * * *")).toBe(false);
    expect(isValidCron("* * * *")).toBe(false);
    expect(isValidCron("* * * * 7")).toBe(false);
    expect(isValidCron("* * * * 0")).toBe(true);
    expect(isValidCron("* * * * 7x")).toBe(false);
  });

  it("computes the next minute-aligned run", () => {
    const after = new Date("2026-01-05T10:00:30Z");
    const next = nextCronRun("* * * * *", after);
    expect(next.toISOString()).toBe("2026-01-05T10:01:00.000Z");
  });

  it("respects hour and minute fields", () => {
    const after = new Date("2026-06-01T12:00:00Z");
    expect(nextCronRun("17 4 * * *", after).toISOString()).toBe("2026-06-02T04:17:00.000Z");
  });

  it("handles step values", () => {
    const after = new Date("2026-06-01T12:07:00Z");
    expect(nextCronRun("*/15 * * * *", after).getUTCMinutes()).toBe(15);
  });

  it("advances month when needed", () => {
    const after = new Date("2026-12-31T23:59:00Z");
    expect(nextCronRun("0 0 * * *", after).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});
