import {
  getBusinessDateOnly,
  normalizeDateOnlyInput,
  resolveBusinessTimeZone,
} from "./business-date.utils";

describe("business-date.utils", () => {
  it("resolves valid IANA time zones and falls back to Asia/Kolkata", () => {
    expect(resolveBusinessTimeZone("Asia/Kolkata")).toBe("Asia/Kolkata");
    expect(resolveBusinessTimeZone("America/New_York")).toBe("America/New_York");
    expect(resolveBusinessTimeZone("not-a-zone")).toBe("Asia/Kolkata");
    expect(resolveBusinessTimeZone(null)).toBe("Asia/Kolkata");
  });

  it("computes calendar date in Asia/Kolkata around UTC midnight", () => {
    // 2026-09-30 18:30 UTC == 2026-10-01 00:00 IST
    const justAfterIstMidnight = new Date("2026-09-30T18:30:00.000Z");
    expect(getBusinessDateOnly(justAfterIstMidnight, "Asia/Kolkata")).toBe(
      "2026-10-01",
    );
    expect(getBusinessDateOnly(justAfterIstMidnight, "UTC")).toBe("2026-09-30");
  });

  it("normalizes date-only strings without shifting the calendar day", () => {
    expect(normalizeDateOnlyInput("2026-10-01")).toBe("2026-10-01");
  });
});
