import { describe, it, expect } from "vitest";
import {
  parseAmountToMinor,
  formatMoney,
  splitEvenly,
  currencyExponent,
  sumMinors
} from "@/lib/money";

describe("money", () => {
  it("parses decimal strings into minor units", () => {
    expect(parseAmountToMinor("10.50", "USD")).toBe(1050);
    expect(parseAmountToMinor("-3", "USD")).toBe(-300);
    expect(parseAmountToMinor("+0.01", "USD")).toBe(1);
    expect(parseAmountToMinor("1,234.56", "USD")).toBe(123456);
    expect(parseAmountToMinor("1000", "JPY")).toBe(1000);
  });

  it("rejects malformed amounts", () => {
    expect(() => parseAmountToMinor("abc", "USD")).toThrow();
    expect(() => parseAmountToMinor("", "USD")).toThrow();
    expect(() => parseAmountToMinor("1.2.3", "USD")).toThrow();
  });

  it("rejects precision beyond the currency exponent", () => {
    try {
      parseAmountToMinor("1.999", "USD");
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as { code?: string }).code).toBe("money.invalid");
    }
    try {
      parseAmountToMinor("1000.5", "JPY");
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as { code?: string }).code).toBe("money.invalid");
    }
    expect(parseAmountToMinor("1000", "JPY")).toBe(1000);
    expect(parseAmountToMinor("1.50", "USD")).toBe(150);
  });

  it("uses correct exponents per currency", () => {
    expect(currencyExponent("USD")).toBe(2);
    expect(currencyExponent("JPY")).toBe(0);
  });

  it("formats for display", () => {
    expect(formatMoney(1050, "USD", "en-US")).toContain("10.50");
    const negative = formatMoney(-500, "USD", "en-US");
    expect(negative.startsWith("-")).toBe(true);
    expect(negative).toContain("5.00");
  });

  it("splits evenly with remainder distribution", () => {
    expect(splitEvenly(100, 3)).toEqual([34, 33, 33]);
    expect(splitEvenly(-100, 3)).toEqual([-34, -33, -33]);
    expect(splitEvenly(0, 4)).toEqual([0, 0, 0, 0]);
  });

  it("guards safe-integer range in sums", () => {
    expect(sumMinors([1, 2, 3])).toBe(6);
    expect(() => sumMinors([Number.MAX_SAFE_INTEGER, 1])).toThrow();
  });
});
