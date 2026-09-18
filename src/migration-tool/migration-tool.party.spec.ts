import {
  ClientType,
} from "../party-profiles/party-profile.entity";
import { CategoryOptionCodeEnum } from "../category-options/category-option-code.enum";
import {
  isJunkCategoryCode,
  isJunkMarketingExecutiveId,
  mapLegacyPartyProfile,
  mapLegacyProductIssuerLink,
  resolvePartyClientType,
  sortPartyRowsForMigration,
} from "./migration-tool.party";
import {
  SAMPLE_MST_CODES_CC,
  SAMPLE_MST_CODES_GS_SKIP,
  SAMPLE_MST_CODES_ME,
  SAMPLE_MST_CODES_MR_DEFERRED,
  SAMPLE_MST_CODES_TA,
  SAMPLE_MST_CODES_TC,
  SAMPLE_PRODUCT_ISSUER_LINK,
} from "./fixtures/party.samples";

describe("migration-tool.party", () => {
  it("maps high-confidence vTypes", () => {
    expect(resolvePartyClientType("TC").clientType).toBe(
      ClientType.CARD_ISSUER_PROFILE,
    );
    expect(resolvePartyClientType("CC").clientType).toBe(
      ClientType.CORPORATE_CLIENT,
    );
    expect(resolvePartyClientType("TA").clientType).toBe(ClientType.AGENT);
    expect(resolvePartyClientType("GS").skipReason).toMatch(/not a party/);
    expect(resolvePartyClientType("MR").skipReason).toMatch(/CQ-2/);
  });

  it("treats 0/1 as junk category / ME sentinels", () => {
    expect(isJunkCategoryCode("0")).toBe(true);
    expect(isJunkCategoryCode("1")).toBe(true);
    expect(isJunkCategoryCode("PB")).toBe(false);
    expect(isJunkMarketingExecutiveId(1)).toBe(true);
    expect(isJunkMarketingExecutiveId(8524)).toBe(false);
  });

  it("maps TC issuer with defaults and empty entity junk", () => {
    const mapped = mapLegacyPartyProfile(SAMPLE_MST_CODES_TC);
    expect(mapped.clientType).toBe(ClientType.CARD_ISSUER_PROFILE);
    expect(mapped.skipReason).toBeNull();
    expect(mapped.code).toBe("THOM");
    expect(mapped.cardNumberLength).toBe(16);
    expect(mapped.allowCardNumberMasking).toBe(false);
    expect(mapped.active).toBe(true);
    expect(mapped.legacyBranchId).toBe("5");
    expect(mapped.legacyDefaultAgentCode).toBeNull();
    expect(
      mapped.categoryRefs.some(
        (ref) =>
          ref.code === CategoryOptionCodeEnum.Group && ref.value === "SRTC",
      ),
    ).toBe(true);
    expect(
      mapped.unmapped.some((field) => field.sourceColumn === "vEntityType"),
    ).toBe(true);
  });

  it("maps CC with blank address as empty string and agent/ME refs", () => {
    const mapped = mapLegacyPartyProfile(SAMPLE_MST_CODES_CC);
    expect(mapped.address1).toBe("");
    expect(mapped.city).toBe("");
    expect(mapped.pinCode).toBe("");
    expect(mapped.legacyDefaultAgentCode).toBe("AARSFO");
    expect(mapped.legacyMarketingExecutiveId).toBe("8524");
    expect(mapped.applyTax).toBe(true);
    expect(mapped.purchase).toBe(true);
    expect(mapped.isTdsDeducted).toBe(true);
    expect(mapped.tds).toBe("10");
  });

  it("skips GS and defers MR", () => {
    expect(mapLegacyPartyProfile(SAMPLE_MST_CODES_GS_SKIP).skipReason).toMatch(
      /not a party/,
    );
    expect(
      mapLegacyPartyProfile(SAMPLE_MST_CODES_MR_DEFERRED).skipReason,
    ).toMatch(/CQ-2/);
  });

  it("sorts ME and TA before CC", () => {
    const sorted = sortPartyRowsForMigration([
      SAMPLE_MST_CODES_CC,
      SAMPLE_MST_CODES_TC,
      SAMPLE_MST_CODES_ME,
      SAMPLE_MST_CODES_TA,
    ]);
    expect(sorted.map((row) => row.vType)).toEqual(["ME", "TA", "TC", "CC"]);
  });

  it("maps product issuer link", () => {
    const mapped = mapLegacyProductIssuerLink(SAMPLE_PRODUCT_ISSUER_LINK);
    expect(mapped.skipReason).toBeNull();
    expect(mapped.productCode).toBe("CC");
    expect(mapped.legacyIssuerId).toBe("9001");
  });
});
