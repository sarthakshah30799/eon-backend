import {
  CurrencyCalculationMethod,
  CurrencyGroup,
  CurrencyProductAllowed,
} from "../currencies/currency.entity";
import {
  toBoolean,
  toNullableNumber,
  toNullableString,
  toStringOrFallback,
  type SourceRow,
} from "./migration-tool.mapping";

export const LEGACY_CURRENCY_TABLE_CANDIDATES = {
  mCurrency: ["mCurrency", "mcurrency", "MCURRENCY"],
  mastCurr: ["MASTCURR", "mastcurr"],
  currencyList: ["MCURRENCYLIST", "mcurrencylist"],
} as const;

const VALID_PRODUCT_ALLOWED = new Set<string>(
  Object.values(CurrencyProductAllowed),
);

export const isMissingLegacyCountryId = (value: any): boolean => {
  if (value === null || value === undefined || value === "") {
    return true;
  }
  const asNumber = toNullableNumber(value);
  return asNumber === 0;
};

export const currencyCountryIsoHint = (code: any): string | null => {
  const text = toNullableString(code)?.toUpperCase() ?? null;
  if (!text || text.length !== 3) {
    return null;
  }
  if (text.startsWith("X") || text === "EUR" || text === "ACU") {
    return null;
  }
  return text.slice(0, 2);
};

export const mapLegacyCalculationMethod = (
  value: any,
): {
  value: CurrencyCalculationMethod;
  transformed: boolean;
} => {
  const text = toNullableString(value);
  if (!text) {
    return {
      value: CurrencyCalculationMethod.MULTIPLICATION,
      transformed: false,
    };
  }
  const normalized = text.trim().toUpperCase();
  if (
    normalized === "D" ||
    normalized === "DIV" ||
    normalized.startsWith("DIV")
  ) {
    return {
      value: CurrencyCalculationMethod.DIVISION,
      transformed: normalized !== CurrencyCalculationMethod.DIVISION,
    };
  }
  if (
    normalized === "M" ||
    normalized === "MUL" ||
    normalized.startsWith("MUL")
  ) {
    return {
      value: CurrencyCalculationMethod.MULTIPLICATION,
      transformed: normalized !== CurrencyCalculationMethod.MULTIPLICATION,
    };
  }
  return {
    value: CurrencyCalculationMethod.MULTIPLICATION,
    transformed: true,
  };
};

export const mapLegacyProductAllowed = (
  value: any,
): CurrencyProductAllowed | "" => {
  const normalized = toNullableString(value)?.toUpperCase() ?? "";
  return VALID_PRODUCT_ALLOWED.has(normalized)
    ? (normalized as CurrencyProductAllowed)
    : "";
};

export const toNumericString = (value: any, fallback: string): string => {
  const n = toNullableNumber(value);
  if (n === null) {
    return fallback;
  }
  return String(n);
};

export type MappedCurrencyRecord = {
  oldId: string | number | null;
  currencyCode: string;
  currencyName: string;
  ratePer: string;
  calculationMethod: CurrencyCalculationMethod;
  calculationMethodTransformed: boolean;
  priority: string;
  legacyCountryId: string | null;
  missingLegacyCountryId: boolean;
  countryIsoHint: string | null;
  countryLookupKeys: string[];
  openRatePremium: string;
  gulfDiscFactor: string;
  amexMapCode: string;
  productAllowedRaw: string | null;
  productAllowed: CurrencyProductAllowed | "";
  onlyStocking: boolean;
  defaultMinRate: string;
  defaultMaxRate: string;
  active: boolean;
  group: typeof CurrencyGroup.ASIA;
  currencyGroupId: string | null;
  issuerAllowed: string | null;
  branchCode: string | null;
  unmapped: Array<{
    sourceColumn: string;
    sourceValue: string | number | boolean | null;
    reason: string;
  }>;
};

export const mapLegacyCurrencyRecord = (row: SourceRow): MappedCurrencyRecord => {
  const oldId =
    row.nCurrencyID ?? row.nCurrencyId ?? row.ncurrencyid ?? row.id ?? row.ID ?? null;
  const currencyCode = toStringOrFallback(row.vCncode, `CUR`).toUpperCase();
  const calculationMethod = mapLegacyCalculationMethod(row.vCalculationMethod);
  const onlyStocking = toBoolean(row.bTradedCurrency);
  const productAllowedRaw = toNullableString(row.vProductAlloowd);
  const mappedProduct = mapLegacyProductAllowed(productAllowedRaw);
  const productAllowed = onlyStocking ? mappedProduct : "";
  const legacyCountryId = isMissingLegacyCountryId(
    row.nCountryID ?? row.nCountryId ?? row.ncountryid,
  )
    ? null
    : toNullableString(row.nCountryID ?? row.nCountryId ?? row.ncountryid);
  const countryIsoHint = currencyCountryIsoHint(currencyCode);
  const countryLookupKeys = [
    ...(legacyCountryId
      ? [
          legacyCountryId,
          `ctr:${legacyCountryId}`,
          `mst:${legacyCountryId}`,
          `lrs:${legacyCountryId}`,
        ]
      : []),
    ...(countryIsoHint
      ? [`code:${countryIsoHint}`, `lrs-code:${countryIsoHint}`, countryIsoHint]
      : []),
  ];
  const unmapped: MappedCurrencyRecord["unmapped"] = [];
  const currencyGroupId = toNullableString(row.nCurrencyGroupID);
  if (currencyGroupId) {
    unmapped.push({
      sourceColumn: "nCurrencyGroupID",
      sourceValue: currencyGroupId,
      reason:
        "No confirmed mapping to currency_rate_groups; currencies.group stays ASIA",
    });
  }
  const issuerAllowed = toNullableString(row.VIssuerAllowed);
  if (issuerAllowed) {
    unmapped.push({
      sourceColumn: "VIssuerAllowed",
      sourceValue: issuerAllowed,
      reason: "currencies has no issuer-allowed column",
    });
  }
  const branchCode = toNullableString(row.vBranchCode);
  if (branchCode) {
    unmapped.push({
      sourceColumn: "vBranchCode",
      sourceValue: branchCode,
      reason: "Currency is not branch-scoped in the new schema",
    });
  }
  if (productAllowedRaw && (!onlyStocking || !mappedProduct)) {
    unmapped.push({
      sourceColumn: "vProductAlloowd",
      sourceValue: productAllowedRaw,
      reason: onlyStocking
        ? "Product code is not CN/CM/CC/ET/TC/TM; productAllowed left empty"
        : "productAllowed is only stored when onlyStocking is true",
    });
  }

  return {
    oldId,
    currencyCode: currencyCode.slice(0, 3),
    currencyName: toStringOrFallback(row.vCnName, currencyCode),
    ratePer: toNumericString(row.nRatePer, "1"),
    calculationMethod: calculationMethod.value,
    calculationMethodTransformed: calculationMethod.transformed,
    priority: toNumericString(row.nPriority, "0"),
    legacyCountryId,
    missingLegacyCountryId: !legacyCountryId,
    countryIsoHint,
    countryLookupKeys,
    openRatePremium: toNumericString(row.nOpenRatePremium, "0"),
    gulfDiscFactor: toNumericString(row.nGulfDiscFactor, "0"),
    amexMapCode: toNullableString(row.vAmexCode) ?? "",
    productAllowedRaw,
    productAllowed,
    onlyStocking,
    defaultMinRate: toNumericString(row.nDefaultMinRate, "0"),
    defaultMaxRate: toNumericString(row.nDefaultMaxRate, "0"),
    active: toBoolean(row.bIsActive),
    group: CurrencyGroup.ASIA,
    currencyGroupId,
    issuerAllowed,
    branchCode,
    unmapped,
  };
};

export const indexMastCurrByCode = (
  rows: SourceRow[],
): Map<string, string> => {
  const map = new Map<string, string>();
  for (const row of rows) {
    const code = toNullableString(row.CNCODENEW ?? row.cncodenew)?.toUpperCase();
    const name = toNullableString(row.CNNAMENEW ?? row.cnnamenew);
    if (code && name && !map.has(code)) {
      map.set(code, name);
    }
  }
  return map;
};

export const indexCurrencyListCodes = (rows: SourceRow[]): Set<string> => {
  const codes = new Set<string>();
  for (const row of rows) {
    const code = toNullableString(row.cncode ?? row.CNCODE)?.toUpperCase();
    if (code) {
      codes.add(code);
    }
  }
  return codes;
};
