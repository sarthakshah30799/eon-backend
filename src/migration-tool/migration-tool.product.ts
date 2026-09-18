import {
  toBoolean,
  toNullableNumber,
  toNullableString,
  toStringOrFallback,
  type SourceRow,
} from "./migration-tool.mapping";

export const LEGACY_PRODUCT_TABLE_CANDIDATES = {
  product: ["mProductM", "mproductm", "MPRODUCTM"],
  productIssuerLink: [
    "mProductIssuerLink",
    "mproductissuerlink",
    "MPRODUCTISSUERLINK",
  ],
  branchProductLink: [
    "mstBranchProductLink",
    "mstbranchproductlink",
    "MSTBRANCHPRODUCTLINK",
  ],
  currencyProductLink: [
    "mCurrencyProductLink",
    "mcurrencyproductlink",
    "MCURRENCYPRODUCTLINK",
  ],
} as const;

export type UnmappedProductField = {
  sourceColumn: string;
  sourceValue: string | number | boolean | null;
  reason: string;
};

export type ProductAccountCodeFields = {
  profitAc: string | null;
  acOfIssuer: string | null;
  commissionAc: string | null;
  openAc: string | null;
  closingAc: string | null;
  expenseAc: string | null;
  purchaseAc: string | null;
  saleAc: string | null;
  fakeAccount: string | null;
  bulkPurAc: string | null;
  bulkSaleAc: string | null;
  bulkProficAc: string | null;
  purchaseRetCancAc: string | null;
  purchaseBlkCancAc: string | null;
  saleRetCancAc: string | null;
  saleBlkCancAc: string | null;
  branchPurAc: string | null;
  branchSaleAc: string | null;
  profitAcBrnSale: string | null;
};

export type MappedProductRecord = {
  oldId: string | number | null;
  productCode: string;
  productDescription: string;
  availableInRetailBuying: boolean;
  retailBuyingSeriesApplicable: boolean;
  availableInRetailSelling: boolean;
  retailSellingSeriesApplicable: boolean;
  availableInBulkBuying: boolean;
  bulkBuyingSeriesApplicable: boolean;
  availableInBulkSelling: boolean;
  bulkSellingSeriesApplicable: boolean;
  instrumentIssuingAuthorityRequired: boolean;
  maintainBlankStockOfProduct: boolean;
  denominationApplicable: boolean;
  productRequiresSettlement: boolean;
  isActiveProduct: boolean;
  levelPriority: string;
  reversalEffectOfProfits: boolean;
  passAutoReceiptOfStockWhenSold: boolean;
  allowFractionInFEAmount: boolean;
  allowMulticard: boolean;
  retail: string;
  commLimit: string;
  maxAmtComm: string;
  automateSettlementRate: boolean;
  separateSettlementForEachInstrument: boolean;
  pickSaleRateAvgAsSettlementRate: boolean;
  bulkFee: string;
  splitAndStoreBlankStockReceived: boolean;
  allowChangingDenominationInSales: boolean;
  reload: boolean;
  allowAddOnLinking: boolean;
  askReference: boolean;
  allowProductCancellation: boolean;
  accountCodes: ProductAccountCodeFields;
  eefcAccountCodes: Record<string, string | null>;
  unmapped: UnmappedProductField[];
};

export type MappedCurrencyProductLink = {
  legacyCurrencyId: string | null;
  productCode: string;
  isActive: boolean;
  unmapped: UnmappedProductField[];
};

const accountCode = (row: SourceRow, ...keys: string[]): string | null => {
  for (const key of keys) {
    const value = toNullableString(row[key])?.trim().toUpperCase() ?? null;
    if (value) {
      return value;
    }
  }
  return null;
};

export const mapLegacyProductRecord = (row: SourceRow): MappedProductRecord => {
  const oldId =
    row.nProductID ?? row.nProductId ?? row.nproductid ?? row.id ?? row.ID ?? null;
  const productCode = toStringOrFallback(row.PRODUCTCODE ?? row.ProductCode, "XX")
    .trim()
    .toUpperCase()
    .slice(0, 2);
  const retailBuy = toBoolean(row.retailBuy);
  const retailSell = toBoolean(row.retailSell);
  const bulkBuy = toBoolean(row.bulkBuy);
  const bulkSell = toBoolean(row.bulkSell);
  const unmapped: UnmappedProductField[] = [];

  const accountCodes: ProductAccountCodeFields = {
    profitAc: accountCode(row, "vProfitAccountCode"),
    acOfIssuer: accountCode(row, "vIssuerAccountCode"),
    commissionAc: accountCode(row, "vCommAccountCode"),
    openAc: accountCode(row, "vOpeningAccountCode"),
    closingAc: accountCode(row, "vClosingAccountCode"),
    expenseAc: accountCode(row, "vExportAccountCode"),
    purchaseAc: accountCode(row, "vPurchaseAccountCode"),
    saleAc: accountCode(row, "vSaleAccountCode"),
    fakeAccount: accountCode(row, "vFakeAccountcode", "vFakeAccountCode"),
    bulkPurAc: accountCode(row, "vBulkPurchaseAccountCode"),
    bulkSaleAc: accountCode(row, "vBulkSaleAccountCode"),
    bulkProficAc: accountCode(row, "vBulkProfitAccountCode"),
    purchaseRetCancAc: accountCode(row, "vPurRetCanAccountCode"),
    purchaseBlkCancAc: accountCode(row, "vPurBlkCanAccountCode"),
    saleRetCancAc: accountCode(row, "vSaleRetCanAccountCode"),
    saleBlkCancAc: accountCode(row, "vSaleBlkCanAccountCode"),
    branchPurAc: accountCode(row, "vPurchaseBranchAccountCode"),
    branchSaleAc: accountCode(row, "vSaleBranchAccountCode"),
    profitAcBrnSale: accountCode(row, "vBrnProfitAccountCode"),
  };

  const eefcAccountCodes = {
    vSaleEEFCAccountCode: accountCode(row, "vSaleEEFCAccountCode"),
    vSaleProfitEEFCAccountCode: accountCode(row, "vSaleProfitEEFCAccountCode"),
    vPurchaseEEFCAccountCode: accountCode(row, "vPurchaseEEFCAccountCode"),
    vEEFCAccountCode: accountCode(row, "vEEFCAccountCode"),
  };
  for (const [sourceColumn, sourceValue] of Object.entries(eefcAccountCodes)) {
    if (sourceValue) {
      unmapped.push({
        sourceColumn,
        sourceValue,
        reason:
          "products has no EEFC account FK columns; resolve later or log only",
      });
    }
  }

  if (!toNullableString(row.availableInOtherTransaction)) {
    // no legacy column — leave false, no unmapped noise
  }

  return {
    oldId,
    productCode,
    productDescription: toStringOrFallback(
      row.DESCRIPTION ?? row.Description,
      productCode,
    ),
    availableInRetailBuying: retailBuy,
    retailBuyingSeriesApplicable: retailBuy && toBoolean(row.retailBuySeries),
    availableInRetailSelling: retailSell,
    retailSellingSeriesApplicable: retailSell && toBoolean(row.retailSellSeries),
    availableInBulkBuying: bulkBuy,
    bulkBuyingSeriesApplicable: bulkBuy && toBoolean(row.bulkBuySeries),
    availableInBulkSelling: bulkSell,
    bulkSellingSeriesApplicable: bulkSell && toBoolean(row.bulkSellSeries),
    instrumentIssuingAuthorityRequired: toBoolean(row.IssuerRequire),
    maintainBlankStockOfProduct: toBoolean(row.blankStock),
    denominationApplicable: toBoolean(row.blankStockDeno),
    productRequiresSettlement: toBoolean(row.isSettlement),
    isActiveProduct: toBoolean(row.isActive) && !toBoolean(row.bIsDeleted),
    levelPriority: String(toNullableNumber(row.Priority) ?? 0),
    reversalEffectOfProfits: toBoolean(row.reverseProfit),
    passAutoReceiptOfStockWhenSold: toBoolean(row.AUTOSTOCK),
    allowFractionInFEAmount: toBoolean(row.allowFractions),
    allowMulticard: toBoolean(row.AllowMultiCard),
    retail: toStringOrFallback(row.RetailFees, "0"),
    commLimit: toStringOrFallback(row.COMMPERCENT, "0"),
    maxAmtComm: toStringOrFallback(row.COMMAMT, "0"),
    automateSettlementRate: toBoolean(row.AUTOSETTRATE),
    separateSettlementForEachInstrument: toBoolean(row.passSeparateSett),
    pickSaleRateAvgAsSettlementRate: toBoolean(row.saleAvgSett),
    bulkFee: toStringOrFallback(row.BulkFees, "0"),
    splitAndStoreBlankStockReceived: toBoolean(row.stockSplit),
    allowChangingDenominationInSales: toBoolean(row.stockDenoChange),
    reload: toBoolean(row.bReload),
    allowAddOnLinking: toBoolean(row.AllAddOn),
    askReference: toBoolean(row.bAskReference),
    allowProductCancellation: toBoolean(row.IsAllowCancellation),
    accountCodes,
    eefcAccountCodes,
    unmapped,
  };
};

export const mapLegacyCurrencyProductLink = (
  row: SourceRow,
): MappedCurrencyProductLink => {
  const productCode = toStringOrFallback(
    row.vProductCode ?? row.PRODUCTCODE,
    "",
  )
    .trim()
    .toUpperCase();
  const unmapped: UnmappedProductField[] = [];
  if (!productCode) {
    unmapped.push({
      sourceColumn: "vProductCode",
      sourceValue: null,
      reason: "Product code missing",
    });
  }

  return {
    legacyCurrencyId: toNullableString(row.nCurrencyID ?? row.nCurrencyId),
    productCode,
    isActive: toBoolean(row.bIsActive ?? row.bActive ?? 1),
    unmapped,
  };
};
