import { CategoryOptionCodeEnum } from "../category-options/category-option-code.enum";
import {
  toBoolean,
  toNullableNumber,
  toNullableString,
  toStringOrFallback,
  type SourceRow,
} from "./migration-tool.mapping";

export const LEGACY_FINANCIAL_TABLE_CANDIDATES = {
  financialProfile: ["FinancialProfile", "financialprofile", "FINANCIALPROFILE"],
  financialSubProfile: [
    "FinancialSubProfile",
    "financialsubprofile",
    "FINANCIALSUBPROFILE",
  ],
} as const;

/** Legacy vFinType single-letter codes → FINANCIALTYPE category value/label. */
export const LEGACY_FIN_TYPE_LABELS: Record<string, string> = {
  B: "BALANCE SHEET",
  P: "PROFIT & LOSS",
  T: "TRADING",
};

export type UnmappedFinancialField = {
  sourceColumn: string;
  sourceValue: string | number | boolean | null;
  reason: string;
};

export type MappedFinancialCode = {
  oldId: string | number | null;
  financialCode: string;
  financialName: string;
  financialTypeValue: string;
  financialTypeLabel: string;
  defaultSignValue: string;
  defaultSignLabel: string;
  defaultSignTransformed: boolean;
  priority: number;
  active: boolean;
  branchCode: string | null;
  unmapped: UnmappedFinancialField[];
};

export type MappedFinancialSubProfile = {
  oldId: string | number | null;
  legacyFinancialId: string | null;
  financialSubCode: string;
  financialSubName: string;
  priority: number;
  active: boolean;
  unmapped: UnmappedFinancialField[];
};

export const mapLegacyDefaultSign = (
  value: any,
): { value: string; label: string; transformed: boolean } => {
  const raw = toNullableString(value)?.trim().toUpperCase() ?? null;
  if (!raw) {
    return { value: "NONE", label: "NONE", transformed: true };
  }
  if (raw === "D" || raw === "DEBIT" || raw === "DR") {
    return {
      value: "DEBIT",
      label: "DEBIT",
      transformed: raw !== "DEBIT",
    };
  }
  if (raw === "C" || raw === "CREDIT" || raw === "CR") {
    return {
      value: "CREDIT",
      label: "CREDIT",
      transformed: raw !== "CREDIT",
    };
  }
  return { value: raw, label: raw, transformed: false };
};

export const mapLegacyFinancialType = (
  value: any,
): { value: string; label: string } => {
  const raw = toStringOrFallback(value, "B").trim().toUpperCase();
  return {
    value: raw,
    label: LEGACY_FIN_TYPE_LABELS[raw] ?? raw,
  };
};

export const mapLegacyFinancialProfile = (
  row: SourceRow,
): MappedFinancialCode => {
  const oldId = row.nFID ?? row.nFid ?? row.nfid ?? row.id ?? row.ID ?? null;
  const financialCode = toStringOrFallback(row.vFinCode, "FIN").toUpperCase();
  const financialType = mapLegacyFinancialType(row.vFinType);
  const defaultSign = mapLegacyDefaultSign(row.vDefaultSign);
  const unmapped: UnmappedFinancialField[] = [];
  const branchCode = toNullableString(row.vBranchCode);
  if (branchCode) {
    unmapped.push({
      sourceColumn: "vBranchCode",
      sourceValue: branchCode,
      reason: "financial_codes is not branch-scoped in the new schema",
    });
  }
  if (row.bIsverified !== undefined && row.bIsverified !== null) {
    unmapped.push({
      sourceColumn: "bIsverified",
      sourceValue: toBoolean(row.bIsverified),
      reason: "No verification columns on financial_codes",
    });
  }
  if (row.nTrackingID !== undefined && toNullableNumber(row.nTrackingID)) {
    unmapped.push({
      sourceColumn: "nTrackingID",
      sourceValue: toNullableNumber(row.nTrackingID),
      reason: "No tracking id on financial_codes",
    });
  }

  return {
    oldId,
    financialCode,
    financialName: toStringOrFallback(row.vFinName, financialCode),
    financialTypeValue: financialType.value,
    financialTypeLabel: financialType.label,
    defaultSignValue: defaultSign.value,
    defaultSignLabel: defaultSign.label,
    defaultSignTransformed: defaultSign.transformed,
    priority: toNullableNumber(row.nPriority) ?? 0,
    active: !toBoolean(row.bIsDeleted),
    branchCode,
    unmapped,
  };
};

export const mapLegacyFinancialSubProfile = (
  row: SourceRow,
): MappedFinancialSubProfile => {
  const oldId = row.nSFID ?? row.nSfid ?? row.nsfid ?? row.id ?? row.ID ?? null;
  const legacyFinancialId = toNullableString(row.nFID ?? row.nFid ?? row.nfid);
  const unmapped: UnmappedFinancialField[] = [];
  const branchCode = toNullableString(row.vBranchCode);
  if (branchCode) {
    unmapped.push({
      sourceColumn: "vBranchCode",
      sourceValue: branchCode,
      reason: "financial_sub_profiles is not branch-scoped",
    });
  }

  return {
    oldId,
    legacyFinancialId,
    financialSubCode: toStringOrFallback(row.vSubFinCode, "SUB").toUpperCase(),
    financialSubName: toStringOrFallback(
      row.vSubFinName,
      toStringOrFallback(row.vSubFinCode, "SUB"),
    ),
    priority: toNullableNumber(row.nPriority) ?? 0,
    active: !toBoolean(row.bIsDeleted),
    unmapped,
  };
};

export const financialTypeCategoryCode = CategoryOptionCodeEnum.FinancialType;
export const defaultSignCategoryCode = CategoryOptionCodeEnum.DefaultSign;
