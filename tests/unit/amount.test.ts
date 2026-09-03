import { describe, expect, it } from "vitest";
import { amountTone } from "@/components/finance/amount";

describe("amountTone", () => {
  it("leaves uncolorized amounts unstyled", () => {
    expect(amountTone(100, false)).toBe("");
    expect(amountTone(-100, false)).toBe("");
  });

  it("treats positive display amounts as income", () => {
    expect(amountTone(2500, true)).toBe("text-income");
  });

  it("treats negative display amounts as expenses", () => {
    expect(amountTone(-800, true)).toBe("text-destructive");
  });
});
