import {
  extractPanFromLegacyTaxId,
  mapLegacyBranchRecord,
  mapLegacyCompanyRecord,
  toNullableDate,
  transformBranchCode,
} from "./migration-tool.mapping";
import { MST_COMPANY_BRANCH_SAMPLES } from "./fixtures/mstcompany.samples";
import { MST_COMPANY_RECORD_SAMPLES } from "./fixtures/mstcompanyrecord.samples";

describe("legacy company record mapping", () => {
  it("extracts PAN from GSTIN cgstno and never stores GSTIN as PAN", () => {
    const mapped = MST_COMPANY_RECORD_SAMPLES.map(mapLegacyCompanyRecord);

    expect(mapped).toHaveLength(3);
    mapped.forEach((row) => {
      expect(row.panNo).toBe("AAECG5258K");
      expect(row.panKind).toBe("gstin");
      expect(row.legacyTaxId).toBe("29AAECG5258K1Z5");
      expect(row.panNo).not.toBe(row.legacyTaxId);
    });
  });

  it("does not treat vRBIName as CIN", () => {
    MST_COMPANY_RECORD_SAMPLES.forEach((row) => {
      const mapped = mapLegacyCompanyRecord(row);
      expect(row.vRBIName).toBe("COPORATE OFFICE");
      expect(mapped.cinNo).toBeNull();
    });
  });

  it("reads VRBILICENSENUMBER even though the British spelling column is absent", () => {
    const [current, renamed, former] = MST_COMPANY_RECORD_SAMPLES.map(
      mapLegacyCompanyRecord,
    );

    expect(current.fxRegNo).toBe("AD Category II-No.09/2011");
    expect(renamed.fxRegNo).toBe("AD Category II - No.09/2025");
    expect(former.fxRegNo).toBe("AD Category II-No.09/2025");
    expect(current.aeonLicNo).toBe(current.fxRegNo);
  });

  it("keeps each FROMDATE/TODATE version as its own company row", () => {
    const mapped = MST_COMPANY_RECORD_SAMPLES.map(mapLegacyCompanyRecord);
    const keys = mapped.map(
      (row) => `${row.name}|${row.fromDate?.toISOString()}|${row.toDate?.toISOString()}`,
    );

    expect(new Set(keys).size).toBe(3);
    expect(mapped.map((row) => row.oldId)).toEqual([1, 2, 3]);
    expect(mapped[1].formerlyKnownName).toContain("CIRRUS LOGIC");
    expect(mapped[0].formerlyKnownName).toBeNull();
  });

  it("extracts PAN from a GSTIN or keeps a real PAN", () => {
    expect(extractPanFromLegacyTaxId("29AAECG5258K1Z5")).toEqual({
      pan: "AAECG5258K",
      kind: "gstin",
    });
    expect(extractPanFromLegacyTaxId("AAECG5258K")).toEqual({
      pan: "AAECG5258K",
      kind: "pan",
    });
    expect(extractPanFromLegacyTaxId("")).toEqual({
      pan: null,
      kind: "invalid",
    });
  });
});

describe("legacy branch mapping", () => {
  it("normalizes Prefix to 5 characters from the shared sample", () => {
    const mapped = MST_COMPANY_BRANCH_SAMPLES.map(mapLegacyBranchRecord);

    expect(mapped.map((row) => row.code)).toEqual([
      "AHMCG",
      "BHUBA",
      "BLRDO",
      "BLRCU",
      "CHAND",
    ]);
    mapped.forEach((row) => {
      expect(row.code).toHaveLength(5);
      expect(row.codeSourceField).toBe("Prefix");
      expect(row.codeTransformed).toBe(true);
    });
  });

  it("pads a short branch code to 5 characters", () => {
    expect(transformBranchCode({ vBranchCode: "HO" }).value).toBe("HO000");
    expect(transformBranchCode({ Prefix: "AHMD" }).value).toBe("AHMD0");
  });

  it("maps branch GSTIN and ignores the 1900 RBI date", () => {
    const ahmedabad = mapLegacyBranchRecord(MST_COMPANY_BRANCH_SAMPLES[0]);

    expect(ahmedabad.gstNo).toBe("24AAECG5258K1ZF");
    expect(ahmedabad.fxRegNo).toBe("AD Category II-No.06/2016");
    expect(ahmedabad.fxRegDate).toBeNull();
    expect(ahmedabad.companyOldId).toBe(1);
    expect(ahmedabad.isActive).toBe(true);
    expect(ahmedabad.isHeadOffice).toBe(false);
  });

  it("treats SQL Server 1900-01-01 as a missing date", () => {
    expect(toNullableDate("1900-01-01 00:00:00.000")).toBeNull();
    expect(toNullableDate("2022-06-03 13:29:02.130")).not.toBeNull();
  });

  it("keeps a named branch city as text; blank city still falls back to UNKNOWN", () => {
    expect(mapLegacyBranchRecord(MST_COMPANY_BRANCH_SAMPLES[0]).city).toBe(
      "Aalanavara",
    );
    const bhubaneswar = mapLegacyBranchRecord(MST_COMPANY_BRANCH_SAMPLES[1]);
    expect(bhubaneswar.city).toBe("UNKNOWN");
    expect(bhubaneswar.pinCode).toBe("0");
    expect(bhubaneswar.isActive).toBe(false);
    expect(bhubaneswar.locationTypeRaw).toBe("2");
  });

  it("links every sample branch to company nCompID 1", () => {
    MST_COMPANY_BRANCH_SAMPLES.forEach((row) => {
      expect(mapLegacyBranchRecord(row).companyOldId).toBe(1);
    });
  });
});
