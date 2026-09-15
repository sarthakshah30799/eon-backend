import {
  CurrencyCalculationMethod,
  CurrencyGroup,
} from "../currencies/currency.entity";
import {
  currencyCountryIsoHint,
  indexCurrencyListCodes,
  indexMastCurrByCode,
  isMissingLegacyCountryId,
  mapLegacyCalculationMethod,
  mapLegacyCurrencyRecord,
} from "./migration-tool.currency";
import {
  MASTCURR_SAMPLES,
  MCURRENCYLIST_SAMPLES,
  MCURRENCY_SAMPLES,
} from "./fixtures/mcurrency.samples";

describe("legacy currency mapping", () => {
  const mapped = MCURRENCY_SAMPLES.map(mapLegacyCurrencyRecord);
  const byCode = (code: string) =>
    mapped.find((row) => row.currencyCode === code);

  it("treats mCurrency as the operational master with 3-letter codes", () => {
    expect(mapped.map((row) => row.currencyCode)).toEqual([
      "AED",
      "ARS",
      "AUD",
      "INR",
      "NPR",
      "PKR",
      "USD",
    ]);
    mapped.forEach((row) => expect(row.currencyCode).toHaveLength(3));
  });

  it("maps vCalculationMethod M to MULTIPLICATION", () => {
    expect(mapLegacyCalculationMethod("M")).toEqual({
      value: CurrencyCalculationMethod.MULTIPLICATION,
      transformed: true,
    });
    expect(mapLegacyCalculationMethod("D")).toEqual({
      value: CurrencyCalculationMethod.DIVISION,
      transformed: true,
    });
    expect(byCode("AED")?.calculationMethod).toBe(
      CurrencyCalculationMethod.MULTIPLICATION,
    );
  });

  it("does not use nCountryID 0 or 28807 as a CTR/LRS country id", () => {
    expect(isMissingLegacyCountryId(0)).toBe(true);
    expect(isMissingLegacyCountryId(28807)).toBe(false);
    expect(byCode("AED")).toMatchObject({
      legacyCountryId: "28807",
      missingLegacyCountryId: false,
      countryIsoHint: "AE",
    });
    expect(byCode("AED")?.countryLookupKeys).toEqual(
      expect.arrayContaining(["28807", "code:AE", "AE"]),
    );
    expect(byCode("INR")).toMatchObject({
      missingLegacyCountryId: true,
      countryIsoHint: "IN",
    });
    expect(byCode("USD")?.countryIsoHint).toBe("US");
  });

  it("does not invent a country from ACU or EUR", () => {
    expect(currencyCountryIsoHint("ACU")).toBeNull();
    expect(currencyCountryIsoHint("EUR")).toBeNull();
    expect(currencyCountryIsoHint("XAU")).toBeNull();
  });

  it("maps bTradedCurrency to onlyStocking and keeps AED CC off because it is not stocking", () => {
    expect(byCode("AED")).toMatchObject({
      onlyStocking: false,
      productAllowed: "",
      productAllowedRaw: "CC",
      amexMapCode: "419",
      priority: "69",
      group: CurrencyGroup.ASIA,
    });
    expect(byCode("AED")?.unmapped.map((item) => item.sourceColumn)).toEqual(
      expect.arrayContaining(["nCurrencyGroupID", "vProductAlloowd"]),
    );
  });

  it("keeps INR onlyStocking but does not store invalid WC as productAllowed", () => {
    expect(byCode("INR")).toMatchObject({
      onlyStocking: true,
      productAllowed: "",
      productAllowedRaw: "WC",
      amexMapCode: "",
    });
    expect(
      byCode("INR")?.unmapped.some((item) => item.sourceColumn === "vProductAlloowd"),
    ).toBe(true);
  });

  it("keeps USD min/max rate and mCurrency name, not the MASTCURR label", () => {
    expect(byCode("USD")).toMatchObject({
      currencyName: "U.S. DOLLARS",
      defaultMinRate: "91.47",
      defaultMaxRate: "91.47",
      amexMapCode: "423",
      active: true,
    });
    expect(indexMastCurrByCode(MASTCURR_SAMPLES).get("USD")).toBe(
      "Dollar(U.S.A.)",
    );
  });

  it("treats MASTCURR as a code catalog, not a second currency master", () => {
    const catalog = indexMastCurrByCode(MASTCURR_SAMPLES);
    const operational = new Set(mapped.map((row) => row.currencyCode));
    expect(catalog.get("NPR")).toBe("Rupee(Nepal)");
    expect(catalog.has("ACU")).toBe(true);
    expect(operational.has("ACU")).toBe(false);
  });

  it("treats MCURRENCYLIST as an allowed-code list, not rows to insert", () => {
    const listed = indexCurrencyListCodes(MCURRENCYLIST_SAMPLES);
    expect(listed.has("AED")).toBe(true);
    expect(listed.has("USD")).toBe(true);
    expect(listed.has("AZN")).toBe(true);
    expect(mapped.some((row) => row.currencyCode === "AZN")).toBe(false);
  });
});
