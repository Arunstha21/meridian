import { describe, expect, it } from "vitest";
import { nextOccurrence } from "@/server/domain/recurring";

describe("nextOccurrence", () => {
  it("advances monthly series by one month", () => {
    expect(nextOccurrence("monthly", { dayOfMonth: 15 }, "2026-01-15")).toBe("2026-02-15");
  });

  it("clamps day 31 to shorter months and restores it afterwards", () => {
    expect(nextOccurrence("monthly", { dayOfMonth: 31 }, "2026-01-31")).toBe("2026-02-28");
    expect(nextOccurrence("monthly", { dayOfMonth: 31 }, "2026-02-28")).toBe("2026-03-31");
    expect(nextOccurrence("monthly", { dayOfMonth: 30 }, "2026-04-30")).toBe("2026-05-30");
  });

  it("handles leap-year February", () => {
    expect(nextOccurrence("monthly", { dayOfMonth: 29 }, "2028-01-31")).toBe("2028-02-29");
  });

  it("advances weekly series to the next configured weekday", () => {
    // 2026-08-25 is a Tuesday.
    expect(nextOccurrence("weekly", { weekday: 2 }, "2026-08-25")).toBe("2026-09-01");
    expect(nextOccurrence("weekly", { weekday: 5 }, "2026-08-25")).toBe("2026-08-28");
  });

  it("advances yearly series", () => {
    expect(nextOccurrence("yearly", { month: 7, day: 10 }, "2026-07-10")).toBe("2027-07-10");
    expect(nextOccurrence("yearly", { month: 3, day: 1 }, "2026-07-10")).toBe("2027-03-01");
  });

  it("rejects invalid dates", () => {
    expect(() => nextOccurrence("monthly", { dayOfMonth: 1 }, "not-a-date")).toThrow();
  });
});
