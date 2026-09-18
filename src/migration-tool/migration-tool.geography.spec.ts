import { CountryRiskCategory } from "../country/country.entity";
import {
  cityNameLookupFromCities,
  collectBranchStateLookupValues,
  combineLegacyCities,
  combineLegacyCountries,
  combineLegacyStates,
  countryLookupKeys,
  districtLookupFromCities,
  mapLegacyLocationType,
  pickLegacyCityReference,
  pickLegacyDistrictReference,
  resolveLegacyPlaceText,
  resolveLegacyRecordCity,
} from "./migration-tool.geography";
import {
  CTRCOUNTRY2_SAMPLES,
  CTR_CITY2_SAMPLES,
  CTR_CITY_SAMPLES,
  CTR_CUSTOMER_STATE_SAMPLES,
  CTR_STATE_SAMPLES,
  GST_STATE_SAMPLES,
  LRS_COUNTRY_SAMPLES,
  MST_LOCATION_TYPE_SAMPLES,
  TB_MST_COUNTRY_SAMPLES,
} from "./fixtures/geography.samples";
import { MST_COMPANY_BRANCH_SAMPLES } from "./fixtures/mstcompany.samples";

describe("legacy country combination", () => {
  const combined = combineLegacyCountries({
    ctrRows: [],
    ctr2Rows: CTRCOUNTRY2_SAMPLES,
    mstRows: TB_MST_COUNTRY_SAMPLES,
    lrsRows: LRS_COUNTRY_SAMPLES,
  });

  const byName = (name: string) =>
    combined.find((row) => row.name.toLowerCase() === name.toLowerCase());

  it("keeps ctrcountry2-only islands when CTRCOUNTRY is missing", () => {
    const aland = byName("Aland Islands");
    expect(aland).toMatchObject({
      code: "243",
      ctrCountryCode: "243",
      lrsCountryCode: null,
      sourceTables: ["ctrcountry2"],
    });
  });

  it("merges Afghanistan from ctrcountry2 numeric code and LRS ISO", () => {
    const afghanistan = byName("Afghanistan");
    expect(afghanistan).toMatchObject({
      code: "AF",
      lrsCountryCode: "AF",
      ctrCountryCode: "1",
      ctrNumericCode: "1",
      lrsCountryId: "1",
    });
    expect(afghanistan?.sourceTables).toEqual(
      expect.arrayContaining(["ctrcountry2", "LRSCountry"]),
    );
  });

  it("merges Antigua by name across ctrcountry2 and tb_MstCountry even when ids differ", () => {
    const antigua = byName("Antigua and Barbuda");
    expect(antigua).toMatchObject({
      code: "AG",
      lrsCountryCode: "AG",
      ctrNumericCode: "9",
      mstCountryId: "6",
      mstCtrCode: "1-268",
      baseCountry: false,
      restrictedCountry: false,
      riskCategory: CountryRiskCategory.Low,
    });
    expect(countryLookupKeys(antigua!)).toEqual(
      expect.arrayContaining(["code:AG", "ctr:9", "mst:6"]),
    );
  });

  it("maps India from tb_MstCountry as the base country with ISO IN", () => {
    const india = byName("India");
    expect(india).toMatchObject({
      code: "IN",
      lrsCountryCode: "IN",
      ctrCountryCode: "91",
      mstCountryId: "78",
      baseCountry: true,
      restrictedCountry: true,
      riskCategory: CountryRiskCategory.Low,
    });
    expect(india?.unmapped.map((item) => item.sourceColumn)).toEqual(
      expect.arrayContaining([
        "Nationality",
        "LimitCategory",
        "Limits",
        "RestrictedReason",
        "bActive",
      ]),
    );
  });

  it("maps Myanmar HIGH risk and keeps LRS MM", () => {
    expect(byName("Myanmar")).toMatchObject({
      code: "MM",
      riskCategory: CountryRiskCategory.High,
      restrictedCountry: true,
      baseCountry: false,
    });
  });

  it("does not merge Brazil CTR 29 with LRS 30 by id; it still merges by name", () => {
    const brazil = byName("Brazil");
    expect(brazil).toMatchObject({
      code: "BR",
      ctrNumericCode: "29",
      lrsCountryId: "30",
    });
  });

  it("keeps LRS-only rows that have no CTR match", () => {
    expect(byName("British Overseas Territory")).toMatchObject({
      code: "1W",
      lrsCountryCode: "1W",
      lrsCountryId: "32",
    });
  });
});

describe("legacy state combination", () => {
  const combined = combineLegacyStates({
    ctrRows: CTR_STATE_SAMPLES,
    customerRows: CTR_CUSTOMER_STATE_SAMPLES,
    gstRows: GST_STATE_SAMPLES,
  });

  const byName = (name: string) =>
    combined.find(
      (row) => row.name.toLowerCase() === name.toLowerCase(),
    );

  it("uses CTR letter code and GST code from customer id2 for Andhra Pradesh", () => {
    expect(byName("Andhra Pradesh")).toMatchObject({
      code: "AP",
      ctrStateCode: "AP",
      gstStateCode: "37",
      customerStateId: "2",
    });
  });

  it("keeps Andaman CTR code AN when GST id2 is blank", () => {
    expect(byName("Andaman and Nicobar Islands")).toMatchObject({
      code: "AN",
      ctrStateCode: "AN",
      gstStateCode: null,
      customerStateId: "1",
    });
  });

  it("merges Chandigarh GST 04 with customer state 6", () => {
    expect(byName("Chandigarh")).toMatchObject({
      code: "04",
      gstStateCode: "04",
      customerStateId: "6",
    });
  });

  it("does not invent a GST code for Dadra when id2 is blank", () => {
    expect(byName("Dadra and Nagar Haveli and Daman and Diu")).toMatchObject({
      code: "CS8",
      gstStateCode: null,
      customerStateId: "8",
    });
  });

  it("treats GST UTTRANCHAL as Uttarakhand", () => {
    expect(byName("Uttarakhand") ?? byName("Uttranchal")).toMatchObject({
      gstStateCode: "05",
      code: "05",
    });
  });

  it("maps Gujarat customer GST 24 for later branch FK lookup", () => {
    expect(byName("Gujarat")).toMatchObject({
      gstStateCode: "24",
      customerStateId: "11",
    });
  });
});

describe("legacy location type and branch state FK hints", () => {
  it("stores mstLocationType under category_options LOCATIONTYPE using LId as value", () => {
    expect(MST_LOCATION_TYPE_SAMPLES.map(mapLegacyLocationType)).toEqual([
      { value: "1", label: "City Location", sortOrder: 1, oldId: 1 },
      { value: "2", label: "Rural Location", sortOrder: 2, oldId: 2 },
      { value: "3", label: "Airport Location", sortOrder: 3, oldId: 3 },
    ]);
  });

  it("prefers GSTIN / STDCode over a misleading vLocation for branch state FK", () => {
    expect(
      collectBranchStateLookupValues(MST_COMPANY_BRANCH_SAMPLES[0]),
    ).toEqual(["24", "AN"]);
  });
});

describe("legacy city and district lookup", () => {
  const cities = combineLegacyCities({
    cityRows: CTR_CITY_SAMPLES,
    city2Rows: CTR_CITY2_SAMPLES,
  });
  const cityLookup = cityNameLookupFromCities(cities);
  const districtLookup = districtLookupFromCities(cities);
  const cityByCode = new Map(cities.map((city) => [city.cityCode, city]));
  const byCode = (code: string) => cityByCode.get(code);

  it("keeps one combined row per CITYCODE from the shared samples", () => {
    expect(cities.map((city) => city.cityCode).sort()).toEqual([
      "3620",
      "3633",
      "4943",
      "5794",
      "6604",
      "7902",
    ]);
  });

  it("unions CTRCITY and CTRCITY2 by CITYCODE and stores the name not the code", () => {
    expect(byCode("6604")).toMatchObject({
      name: "A Vellalapatti",
      customerStateId: "31",
      stateName: "Tamil Nadu",
      districtCode: "666",
      districtName: "Madurai",
      sourceTables: ["CTRCITY", "CTRCITY2"],
    });
    expect(
      resolveLegacyRecordCity(
        { nCityID: 6604 },
        { nameLookup: cityLookup, cityByCode },
      ),
    ).toMatchObject({
      value: "A Vellalapatti",
      raw: "6604",
      sourceColumn: "nCityID",
      resolvedFrom: "id",
      city: expect.objectContaining({
        name: "A Vellalapatti",
        stateName: "Tamil Nadu",
        districtName: "Madurai",
      }),
    });
  });

  it("keeps CTRCITY-only Abhanpur without inventing state or district", () => {
    expect(byCode("3620")).toMatchObject({
      name: "Abhanpur",
      customerStateId: null,
      stateName: null,
      districtCode: null,
      districtName: null,
      sourceTables: ["CTRCITY"],
    });
  });

  it("still maps a city when only CTRCITY2 exists", () => {
    const city2Only = combineLegacyCities({
      cityRows: [],
      city2Rows: CTR_CITY2_SAMPLES,
    });
    expect(city2Only.find((city) => city.cityCode === "4943")).toMatchObject({
      name: "Aamby Valley",
      customerStateId: "21",
      stateName: "Maharashtra",
      districtName: "Pune",
      sourceTables: ["CTRCITY2"],
    });
  });

  it("does not treat CTRCITY2 STATECODE or DISTRICTCODE as a city id", () => {
    expect(cityLookup.get("31")).toBeUndefined();
    expect(cityLookup.get("21")).toBeUndefined();
    expect(cityLookup.get("7")).toBeUndefined();
    expect(cityLookup.get("666")).toBeUndefined();
    expect(cityLookup.get("585")).toBeUndefined();
    expect(districtLookup.get("666")).toBe("Madurai");
    expect(districtLookup.get("585")).toBe("Pune");
  });

  it("uses CTRCITY2 STATECODE as the customer state id, matching Chhattisgarh 7", () => {
    expect(byCode("3633")).toMatchObject({
      name: "Aamdi",
      customerStateId: "7",
      stateName: "Chhattisgarh",
      districtName: "Dhamtari",
    });
  });

  it("resolves every consuming-record city id to the city name", () => {
    const consumingRows = [
      { nCityID: 6604 },
      { nCityId: 4943 },
      { CityId: 3633 },
      { CITYCODE: 7902 },
      { vCity: "5794" },
    ];
    const names = consumingRows.map(
      (row) =>
        resolveLegacyRecordCity(row, { nameLookup: cityLookup, cityByCode })
          .value,
    );
    expect(names).toEqual([
      "A Vellalapatti",
      "Aamby Valley",
      "Aamdi",
      "Abbanakuppe",
      "Abdu Rahiman Nagar",
    ]);
    names.forEach((name) => expect(name).not.toMatch(/^\d+$/));
  });

  it("passes through a city name already stored on the source row", () => {
    expect(
      resolveLegacyRecordCity(
        { vCity: "Aalanavara" },
        { nameLookup: cityLookup, cityByCode },
      ),
    ).toMatchObject({
      value: "Aalanavara",
      resolvedFrom: "passthrough",
      city: null,
    });
  });

  it("does not write an unresolved city id into the new city text field", () => {
    expect(
      resolveLegacyRecordCity(
        { nCityID: 999, vCity: "should-not-be-used" },
        { nameLookup: cityLookup, cityByCode, fallback: "UNKNOWN" },
      ),
    ).toMatchObject({
      value: "UNKNOWN",
      raw: "999",
      resolvedFrom: "unresolved-id",
      city: null,
    });
  });

  it("uses UNKNOWN when city is missing", () => {
    expect(
      resolveLegacyRecordCity(
        { vCity: "" },
        { nameLookup: cityLookup, cityByCode, fallback: "UNKNOWN" },
      ),
    ).toMatchObject({
      value: "UNKNOWN",
      resolvedFrom: "missing",
    });
  });

  it("skips city master rows that have no code or name", () => {
    const combined = combineLegacyCities({
      cityRows: [
        { CITYNAME: "Ignored", CITYCODE: "" },
        { CITYNAME: "", CITYCODE: "1" },
        { CITYNAME: "Kept", CITYCODE: "2" },
      ],
    });
    expect(combined).toEqual([
      expect.objectContaining({ cityCode: "2", name: "Kept" }),
    ]);
  });

  it("reads nCityID before vCity so an id is resolved even if vCity is also present", () => {
    expect(
      pickLegacyCityReference({ nCityID: 6604, vCity: "ignored" }),
    ).toEqual({ key: "nCityID", value: "6604" });
    expect(
      resolveLegacyRecordCity(
        { nCityID: 6604, vCity: "ignored" },
        { nameLookup: cityLookup, cityByCode },
      ).value,
    ).toBe("A Vellalapatti");
  });

  it("resolves a district id to the district name from CTRCITY2 without storing it as city", () => {
    expect(
      resolveLegacyPlaceText(
        pickLegacyDistrictReference({ nDistrictID: 666 }),
        districtLookup,
        "",
      ),
    ).toMatchObject({
      value: "Madurai",
      raw: "666",
      resolvedFrom: "id",
    });
  });

  it("keeps GSTIN/STDCode ahead of city-derived state so Ahmedabad stays Gujarat", () => {
    expect(
      collectBranchStateLookupValues(
        {
          ...MST_COMPANY_BRANCH_SAMPLES[0],
          nCityID: 6604,
        },
        cityByCode,
      ),
    ).toEqual(["24", "AN", "31", "Tamil Nadu"]);
  });

  it("can recover Chhattisgarh from a city id when GSTIN is missing", () => {
    expect(
      collectBranchStateLookupValues({ nCityID: 3633 }, cityByCode),
    ).toEqual(["7", "Chhattisgarh"]);
  });
});
