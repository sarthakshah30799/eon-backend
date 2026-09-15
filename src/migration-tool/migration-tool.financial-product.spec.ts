import {
  mapLegacyAccountProfile,
  mapLegacyAccountType,
  mapLegacyBankNature,
} from "./migration-tool.account";
import {
  mapLegacyDefaultSign,
  mapLegacyFinancialProfile,
  mapLegacyFinancialSubProfile,
  mapLegacyFinancialType,
} from "./migration-tool.financial";
import {
  mapLegacyCurrencyProductLink,
  mapLegacyProductRecord,
} from "./migration-tool.product";
import {
  ACCOUNTS_PROFILE_SAMPLES,
  FINANCIAL_PROFILE_SAMPLES,
  FINANCIAL_SUB_PROFILE_SAMPLES,
  MCURRENCY_PRODUCT_LINK_SAMPLES,
  MPRODUCT_SAMPLES,
} from "./fixtures/financial-product.samples";

describe("legacy financial / account / product mapping", () => {
  it("maps FinancialProfile B/P/T and blank defaultSign", () => {
    expect(mapLegacyFinancialType("B")).toEqual({
      value: "B",
      label: "BALANCE SHEET",
    });
    expect(mapLegacyFinancialType("T")).toEqual({
      value: "T",
      label: "TRADING",
    });
    expect(mapLegacyDefaultSign("")).toEqual({
      value: "NONE",
      label: "NONE",
      transformed: true,
    });
    expect(mapLegacyDefaultSign("D")).toEqual({
      value: "DEBIT",
      label: "DEBIT",
      transformed: true,
    });

    const bankbl = mapLegacyFinancialProfile(FINANCIAL_PROFILE_SAMPLES[0]);
    expect(bankbl).toMatchObject({
      oldId: 1,
      financialCode: "BANKBL",
      financialName: "BANK BALANCES",
      financialTypeValue: "B",
      defaultSignValue: "NONE",
      priority: 1,
    });

    const issuer = mapLegacyFinancialProfile(FINANCIAL_PROFILE_SAMPLES[3]);
    expect(issuer).toMatchObject({
      financialCode: "ISSUER",
      defaultSignValue: "DEBIT",
      defaultSignTransformed: true,
    });
    expect(issuer.unmapped.some((u) => u.sourceColumn === "vBranchCode")).toBe(
      true,
    );
  });

  it("maps FinancialSubProfile under parent nFID", () => {
    const sub = mapLegacyFinancialSubProfile(FINANCIAL_SUB_PROFILE_SAMPLES[0]);
    expect(sub).toMatchObject({
      oldId: 1,
      legacyFinancialId: "31",
      financialSubCode: "ISSUER",
      financialSubName: "ISSUER FIN SUB PROFILE NAME",
    });
  });

  it("maps AccountsProfile PURCN with INR hint and GENERAL LEDGER", () => {
    expect(mapLegacyAccountType("G")).toEqual({
      value: "GENERAL_LEDGER",
      label: "GENERAL LEDGER",
    });
    expect(mapLegacyBankNature(1)).toEqual({ value: "BANK", label: "BANK" });

    const purcn = mapLegacyAccountProfile(ACCOUNTS_PROFILE_SAMPLES[0]);
    expect(purcn).toMatchObject({
      accountCode: "PURCN",
      legacyFinancialCode: "PURCH",
      legacyFinancialId: "27",
      missingCurrencyId: true,
      currencyIsoHint: "INR",
      accountTypeValue: "GENERAL_LEDGER",
      bankNatureValue: "NONE",
      active: true,
    });

    const brnctr = mapLegacyAccountProfile(ACCOUNTS_PROFILE_SAMPLES[2]);
    expect(brnctr).toMatchObject({
      accountCode: "BRNCTR",
      accountTypeValue: "SUBSIDIARY",
      subLedgerValue: "B",
      bankNatureValue: "BANK",
    });
  });

  it("maps mProductM CC/CN flags and keeps account codes for later resolve", () => {
    const cc = mapLegacyProductRecord(MPRODUCT_SAMPLES[0]);
    expect(cc).toMatchObject({
      productCode: "CC",
      availableInRetailBuying: false,
      availableInRetailSelling: true,
      retailSellingSeriesApplicable: true,
      instrumentIssuingAuthorityRequired: true,
      allowMulticard: true,
      reload: true,
      productRequiresSettlement: true,
    });
    expect(cc.accountCodes.purchaseAc).toBe("PURCC");
    expect(cc.accountCodes.saleAc).toBe("SALCC");
    expect(
      cc.unmapped.some((u) => u.sourceColumn === "vEEFCAccountCode"),
    ).toBe(true);

    const cn = mapLegacyProductRecord(MPRODUCT_SAMPLES[1]);
    expect(cn).toMatchObject({
      productCode: "CN",
      availableInRetailBuying: true,
      availableInBulkBuying: true,
      availableInBulkSelling: true,
      allowMulticard: false,
      accountCodes: expect.objectContaining({
        purchaseAc: "PURCN",
        profitAc: "PROCN",
      }),
    });
  });

  it("maps mCurrencyProductLink allow-list with active flag", () => {
    const links = MCURRENCY_PRODUCT_LINK_SAMPLES.map(mapLegacyCurrencyProductLink);
    expect(links[0]).toMatchObject({
      legacyCurrencyId: "1",
      productCode: "CC",
      isActive: true,
    });
    expect(links[4]).toMatchObject({
      productCode: "DD",
      isActive: false,
    });
  });
});
