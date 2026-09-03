import { describe, expect, it } from "vitest";
import { todayIn } from "@/lib/datetime";

describe("todayIn", () => {
  it("uses the family's calendar date, not UTC", () => {
    const utcEvening = new Date("2026-01-01T22:00:00Z");
    expect(todayIn("UTC", utcEvening)).toBe("2026-01-01");
    expect(todayIn("Asia/Kathmandu", utcEvening)).toBe("2026-01-02");
    expect(todayIn("America/Los_Angeles", utcEvening)).toBe("2026-01-01");
  });
});
