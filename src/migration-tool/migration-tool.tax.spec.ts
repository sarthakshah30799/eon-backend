import {
  isGst18TaxCode,
  mapLegacyGstInfoRow,
  mapLegacyMstTaxRow,
  mapLegacyTcsPerMasterRow,
  pickGstinFromGstInfo,
  selectTcsPerMasterRowsForSlabs,
  toGstRatePercent,
} from "./migration-tool.tax";
import {
  SAMPLE_GST_INFO,
  SAMPLE_MST_TAX,
  SAMPLE_TCS_PER_MASTER,
} from "./fixtures/tax.samples";

describe("migration-tool.tax", () => {
  describe("toGstRatePercent / isGst18TaxCode", () => {
    it("converts fraction 0.18 to 18", () => {
      expect(toGstRatePercent(0.18)).toBe(18);
      expect(isGst18TaxCode("gst18%")).toBe(true);
      expect(isGst18TaxCode("HFEE")).toBe(false);
    });
  });

  describe("mapLegacyMstTaxRow", () => {
    it("maps gst18% and skips HFEE/TAXROFF", () => {
      const mapped = SAMPLE_MST_TAX.map((row) => mapLegacyMstTaxRow(row));
      const gst = mapped.find((row) => row.code === "gst18%");
      expect(gst?.isGstRateCandidate).toBe(true);
      expect(gst?.ratePercent).toBe(18);
      expect(gst?.skipReason).toBeNull();

      const hfee = mapped.find((row) => row.code === "HFEE");
      expect(hfee?.isGstRateCandidate).toBe(false);
      expect(hfee?.skipReason).toMatch(/HFEE/);
    });
  });

  describe("pickGstinFromGstInfo / mapLegacyGstInfoRow", () => {
    it("prefers IGST then CGST then SGST", () => {
      expect(pickGstinFromGstInfo(SAMPLE_GST_INFO[2])).toEqual({
        gstNo: "27CCCCC0000C1Z5",
        source: "IGSTNO",
      });
      expect(pickGstinFromGstInfo(SAMPLE_GST_INFO[1])).toEqual({
        gstNo: "24AAECG5258K1ZF",
        source: "CGSTNO",
      });
      expect(mapLegacyGstInfoRow(SAMPLE_GST_INFO[0]).skipReason).toMatch(
        /No IGSTNO/,
      );
    });
  });

  describe("selectTcsPerMasterRowsForSlabs", () => {
    it("keeps latest window and prefers ITR=true duplicate", () => {
      const mapped = SAMPLE_TCS_PER_MASTER.map((row) =>
        mapLegacyTcsPerMasterRow(row),
      );
      const { selected, skipped } = selectTcsPerMasterRowsForSlabs(mapped);
      expect(selected.some((row) => row.legacyPurposeCode === "S")).toBe(true);
      expect(selected.some((row) => row.legacyPurposeCode === "M")).toBe(true);
      expect(
        selected.find((row) => row.legacyPurposeCode === "S")?.itrProcessed,
      ).toBe(true);
      expect(skipped.some((item) => /Older FROMDATE/.test(item.reason))).toBe(
        true,
      );
      expect(
        skipped.some((item) => /Duplicate slab band/.test(item.reason)),
      ).toBe(true);
    });
  });
});
