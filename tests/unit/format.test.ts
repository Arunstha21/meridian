import { describe, expect, it } from "vitest";
import { pluralize } from "@/lib/format";

describe("pluralize", () => {
  it("uses the singular for one and plural otherwise", () => {
    expect(pluralize(1, "account")).toBe("1 account");
    expect(pluralize(3, "account")).toBe("3 accounts");
    expect(pluralize(0, "transfer")).toBe("0 transfers");
  });

  it("accepts an irregular plural", () => {
    expect(pluralize(1, "series", "series")).toBe("1 series");
    expect(pluralize(2, "series", "series")).toBe("2 series");
  });
});
