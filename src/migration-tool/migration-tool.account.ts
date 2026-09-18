import { CategoryOptionCodeEnum } from "../category-options/category-option-code.enum";
import {
  toBoolean,
  toNullableNumber,
  toNullableString,
  toStringOrFallback,
  type SourceRow,
} from "./migration-tool.mapping";

export const LEGACY_ACCOUNT_TABLE_CANDIDATES = {
  accountsProfile: ["AccountsProfile", "accountsprofile", "ACCOUNTSPROFILE"],
  accountsBankDtls: ["AccountsBankDtls", "accountsbankdtls", "ACCOUNTSBANKDTLS"],
} as const;

export type UnmappedAccountField = {
  sourceColumn: string;
  sourceValue: string | number | boolean | null;
  reason: string;
};

export type MappedAccountProfile = {
  oldId: string | number | null;
  accountCode: string;
  accountName: string;
  legacyFinancialId: string | null;
  legacyFinancialCode: string | null;
  legacySubFinancialId: string | null;
  legacyCurrencyId: string | null;
  missingCurrencyId: boolean;
  currencyIsoHint: string | null;
  divisionDeptValue: string | null;
  accountTypeValue: string | null;
  accountTypeLabel: string | null;
  subLedgerValue: string | null;
  bankNatureValue: string;
  bankNatureLabel: string;
  zeroBalanceAtEod: boolean;
  retailPurchase: boolean;
  retailSale: boolean;
  receipt: boolean;
  payment: boolean;
  active: boolean;
  cmsBank: boolean;
  directRemittance: boolean;
  isSystemAccount: boolean;
  branchCode: string | null;
  unmapped: UnmappedAccountField[];
};

export const mapLegacyAccountType = (
  nature: any,
): { value: string; label: string } | null => {
  const raw = toNullableString(nature)?.trim().toUpperCase() ?? null;
  if (!raw) {
    return null;
  }
  if (raw === "G") {
    return { value: "GENERAL_LEDGER", label: "GENERAL LEDGER" };
  }
  if (raw === "S") {
    return { value: "SUBSIDIARY", label: "SUBSIDIARY" };
  }
  return { value: raw, label: raw };
};

export const mapLegacyBankNature = (
  bankType: any,
): { value: string; label: string } => {
  const n = toNullableNumber(bankType);
  if (n === 1) {
    return { value: "BANK", label: "BANK" };
  }
  return { value: "NONE", label: "NONE" };
};

export const mapLegacyAccountProfile = (
  row: SourceRow,
): MappedAccountProfile => {
  const oldId =
    row.nAccID ?? row.nAccId ?? row.naccid ?? row.id ?? row.ID ?? null;
  const accountCode = toStringOrFallback(row.vCode, "ACC").toUpperCase();
  const accountType = mapLegacyAccountType(row.vNature);
  const bankNature = mapLegacyBankNature(row.vBankType);
  const legacyCurrencyRaw = row.nCurrencyID ?? row.nCurrencyId ?? row.ncurrencyid;
  const legacyCurrencyNum = toNullableNumber(legacyCurrencyRaw);
  const missingCurrencyId =
    legacyCurrencyRaw === null ||
    legacyCurrencyRaw === undefined ||
    legacyCurrencyRaw === "" ||
    legacyCurrencyNum === 0;
  const legacyCurrencyId = missingCurrencyId
    ? null
    : toNullableString(legacyCurrencyRaw);
  const legacySubId = toNullableNumber(row.nSFID ?? row.nSfid);
  const unmapped: UnmappedAccountField[] = [];

  const pushUnmapped = (
    sourceColumn: string,
    sourceValue: string | number | boolean | null,
    reason: string,
  ) => {
    if (sourceValue === null || sourceValue === undefined || sourceValue === "") {
      return;
    }
    if (sourceValue === 0 || sourceValue === false) {
      return;
    }
    unmapped.push({ sourceColumn, sourceValue, reason });
  };

  pushUnmapped(
    "nBranchIDtoTransfer",
    toNullableNumber(row.nBranchIDtoTransfer),
    "branchIdToTransfer resolution deferred until branch map is applied in service",
  );
  pushUnmapped(
    "nBranchControlID",
    toNullableNumber(row.nBranchControlID),
    "No branch-control FK on account_profiles",
  );
  pushUnmapped(
    "nPCColID",
    toNullableNumber(row.nPCColID),
    "pettyCashExpenseId mapping not confirmed",
  );
  pushUnmapped(
    "bDataEntryPrevilege",
    toBoolean(row.bDataEntryPrevilege),
    "No data-entry privilege flag on account_profiles",
  );
  pushUnmapped(
    "IsSystemAccount",
    toBoolean(row.IsSystemAccount),
    "No isSystemAccount column; journalVoucher may be derived later",
  );
  const branchCode = toNullableString(row.vBranchCode);
  if (branchCode) {
    unmapped.push({
      sourceColumn: "vBranchCode",
      sourceValue: branchCode,
      reason: "account_profiles is not branch-scoped via vBranchCode",
    });
  }

  const subLedgerRaw = toNullableString(row.vSblnat)?.trim().toUpperCase() ?? null;

  return {
    oldId,
    accountCode,
    accountName: toStringOrFallback(row.vName, accountCode),
    legacyFinancialId: toNullableString(row.nFID ?? row.nFid),
    legacyFinancialCode: toNullableString(row.vFinCode)?.toUpperCase() ?? null,
    legacySubFinancialId:
      legacySubId && legacySubId !== 0 ? String(legacySubId) : null,
    legacyCurrencyId,
    missingCurrencyId,
    currencyIsoHint: missingCurrencyId ? "INR" : null,
    divisionDeptValue: (() => {
      const d = toNullableNumber(row.nDivisionID);
      return d && d !== 0 ? String(d) : null;
    })(),
    accountTypeValue: accountType?.value ?? null,
    accountTypeLabel: accountType?.label ?? null,
    subLedgerValue: subLedgerRaw,
    bankNatureValue: bankNature.value,
    bankNatureLabel: bankNature.label,
    zeroBalanceAtEod: toBoolean(row.bZeroBalatEOD),
    retailPurchase: toBoolean(row.bDoPurchase),
    retailSale: toBoolean(row.bDoSales),
    receipt: toBoolean(row.bDoReceipts),
    payment: toBoolean(row.bDoPayments),
    active: toBoolean(row.bActive) && !toBoolean(row.bIsDeleted),
    cmsBank: toBoolean(row.bCMSBank),
    directRemittance: toBoolean(row.bDirectRemit),
    isSystemAccount: toBoolean(row.IsSystemAccount),
    branchCode,
    unmapped,
  };
};

export const accountCategoryCodes = {
  divisionDept: CategoryOptionCodeEnum.DivisionDept,
  accountType: CategoryOptionCodeEnum.AccountType,
  subLedger: CategoryOptionCodeEnum.SubLedger,
  bankNature: CategoryOptionCodeEnum.BankNature,
} as const;
