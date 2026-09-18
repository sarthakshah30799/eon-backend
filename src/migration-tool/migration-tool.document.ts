import { DocumentSpecificationType } from "../document-profiles/document-profile.entity";

export type SourceRow = Record<string, any>;

export const DOCUMENT_PROFILE_MAX_SIZE_MB_DEFAULT = 5;
export const DOCUMENT_PROFILE_DOCUMENT_TYPE_DEFAULT = ["PNG"] as const;
export const DOCUMENT_CODE_MAX_LENGTH = 50;

export const LEGACY_DOCUMENT_TABLE_CANDIDATES = {
  scanDocMaster: ["ScanDocMaster", "scandocmaster", "SCANDOCMASTER"],
  docCheck: ["DOCCHECK", "DocCheck", "doccheck"],
} as const;

export type UnmappedDocumentField = {
  sourceColumn: string;
  sourceValue: string | number | boolean | null;
  reason: string;
};

const toNullableString = (value: any): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
};

const toNullableNumber = (value: any): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
};

const toBoolean = (value: any): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return (
      normalized === "1" ||
      normalized === "true" ||
      normalized === "y" ||
      normalized === "yes"
    );
  }
  return false;
};

export type MappedScanDocMasterRow = {
  oldId: string | null;
  uniqCode: string | null;
  documentCode: string | null;
  description: string | null;
  isRequired: boolean;
  sortOrder: number;
  active: boolean;
  isDeleted: boolean;
  specificationType: DocumentSpecificationType | null;
  groupCode: string | null;
  entityCode: string | null;
  financialYearCode: string | null;
  maxSizeMb: number;
  documentType: string[];
  skipReason: string | null;
  unmapped: UnmappedDocumentField[];
};

export const mapScanDocMasterRow = (
  row: SourceRow,
): MappedScanDocMasterRow => {
  const unmapped: UnmappedDocumentField[] = [];
  const uniqCode =
    row.nUniqCode != null && row.nUniqCode !== ""
      ? String(row.nUniqCode)
      : null;
  const documentCode = toNullableString(
    row.vDocumentCode ?? row.VDocumentCode ?? row.documentCode,
  )?.toUpperCase() ?? null;
  const description = toNullableString(
    row.vDocumentDesc ?? row.VDocumentDesc ?? row.description,
  );
  const scanFor = (
    toNullableString(row.vScanFor ?? row.VScanFor) ?? ""
  ).toUpperCase();
  const groupCode = toNullableString(row.KYCGroup ?? row.kycGroup);
  const entityCode = toNullableString(row.vScanType ?? row.VScanType);
  const financialYearCode = toNullableString(row.KYCYear ?? row.kycYear);
  const sortOrder = toNullableNumber(row.nPriority ?? row.NPriority) ?? 0;
  const isRequired = toBoolean(row.bIsRequired ?? row.BIsRequired);
  const active = toBoolean(row.bIsActive ?? row.BIsActive ?? 1);
  const isDeleted = toBoolean(row.bIsDeleted ?? row.BIsDeleted);

  let specificationType: DocumentSpecificationType | null = null;
  let skipReason: string | null = null;
  if (scanFor === "M") {
    specificationType = DocumentSpecificationType.MASTER;
  } else if (scanFor === "T") {
    specificationType = DocumentSpecificationType.TRANSACTION;
  } else {
    skipReason = `vScanFor ${scanFor || "?"} is not M/T`;
  }

  if (!documentCode && !skipReason) {
    skipReason = "Missing vDocumentCode";
  }

  for (const col of ["vSubType", "RenewalType", "dFromDate"] as const) {
    const value = row[col];
    if (value != null && String(value).trim() !== "") {
      unmapped.push({
        sourceColumn: col,
        sourceValue: value,
        reason: "Not stored on document_profiles",
      });
    }
  }

  return {
    oldId: uniqCode,
    uniqCode,
    documentCode,
    description,
    isRequired,
    sortOrder,
    active,
    isDeleted,
    specificationType,
    groupCode,
    entityCode,
    financialYearCode,
    maxSizeMb: DOCUMENT_PROFILE_MAX_SIZE_MB_DEFAULT,
    documentType: [...DOCUMENT_PROFILE_DOCUMENT_TYPE_DEFAULT],
    skipReason,
    unmapped,
  };
};

/**
 * If `code` already used, return `{code}-{uniqCode}` truncated to 50.
 * Caller should add the returned code to `existingCodes`.
 */
export const disambiguateDocumentCode = (
  code: string,
  uniqCode: string | number,
  existingCodes: Set<string>,
): string => {
  const base = code.trim().toUpperCase();
  if (!existingCodes.has(base)) {
    return base.slice(0, DOCUMENT_CODE_MAX_LENGTH);
  }
  const suffix = String(uniqCode).trim();
  const candidate = `${base}-${suffix}`;
  return candidate.slice(0, DOCUMENT_CODE_MAX_LENGTH);
};
