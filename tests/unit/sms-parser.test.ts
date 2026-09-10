import { describe, it, expect } from "vitest";
import { parseSms } from "@/server/domain/sms-parser";

describe("sms-parser", () => {
  it("parses Laxmi Sunrise credit SMS correctly", () => {
    const text = `Dear Customer, Your #88011052 has been credited by NPR 770.00 on 10/09/26. Remarks:FPQR-479651654-5834-24:FPQR-479651654-5834-24
-Laxmi Sunrise`;
    const sender = "LAXMI";

    const parsed = parseSms(text, sender);
    expect(parsed.kind).toBe("income");
    expect(parsed.amountMajor).toBe(770);
    expect(parsed.amountMinor).toBe(77000);
    expect(parsed.currency).toBe("NPR");
    expect(parsed.date).toBe("2026-09-10");
    expect(parsed.bankName).toBe("Laxmi Sunrise");
    expect(parsed.accountNumber).toBe("88011052");
    expect(parsed.accountDigits).toBe("88011052");
    expect(parsed.referenceId).toBeTruthy();
  });

  it("parses Nabil Bank debit SMS correctly", () => {
    const text = `Dear Customer, Your 110##02167 has been withdrawn by NPR 24,360.00 on 09/09/2026 14:13:30, Remarks: PREPAID CARD 150 T
Download App: https://rebrand.ly/nBank`;
    const sender = "Nabil_Alert";

    const parsed = parseSms(text, sender);
    expect(parsed.kind).toBe("expense");
    expect(parsed.amountMajor).toBe(24360);
    expect(parsed.amountMinor).toBe(2436000);
    expect(parsed.currency).toBe("NPR");
    expect(parsed.date).toBe("2026-09-09");
    expect(parsed.bankName).toBe("Nabil Bank");
    expect(parsed.accountNumber).toBe("110##02167");
    expect(parsed.accountDigits).toBe("02167");
    expect(parsed.remarks).toContain("PREPAID CARD 150 T");
  });

  it("parses Siddhartha Bank deposit SMS correctly", () => {
    const text = `Dear ARUN, AC 0###15###9850, NPR 5,000.00 deposited on 09/09/2026 14:11:48 for Fund Trf frm NABIL BANK LTD -178894247201261c
Siddhartha Bank`;
    const sender = "SBL_ALERT";

    const parsed = parseSms(text, sender);
    expect(parsed.kind).toBe("income");
    expect(parsed.amountMajor).toBe(5000);
    expect(parsed.amountMinor).toBe(500000);
    expect(parsed.currency).toBe("NPR");
    expect(parsed.date).toBe("2026-09-09");
    expect(parsed.bankName).toBe("Siddhartha Bank");
    expect(parsed.accountDigits).toBe("9850");
    expect(parsed.remarks).toContain("Fund Trf frm NABIL BANK LTD");
    expect(parsed.referenceId).toContain("178894247201261c");
  });
});
