export type SourceRow = Record<string, any>;

export const DOCUMENT_PROFILE_MAX_SIZE_MB_DEFAULT = 5;
export const DOCUMENT_PROFILE_TYPE_DEFAULT = ["PNG"] as const;
export const DOCUMENT_CODE_MAX_LENGTH = 50;

export const LEGACY_DOCUMENT_TABLE_CANDIDATES = {
  scanDocMaster: ["ScanDocMaster", "scandocmaster", "SCANDOCMASTER"],
} as const;

export type UnmappedDocumentField = {
  sourceColumn: string;
  sourceValue: string | number | boolean | null;
  reason: string;
};

export type MappedScanDocMaster = {
  oldId: string | null;
  documentCode: string;
  documentDescription: string;
  isRequired: boolean;
  sortOrder: number;
  active: boolean;
  isDeleted: boolean;
  specificationType: "MASTER" | "TRANSACTION" | null;
  kycGroup: string | null;
  scanType: string | null;
  kycYear: string | null;
  renewalType: string | null;
  maxSizeMb: number;
  documentType: string[];
  skipReason: string | null;
  unmapped: UnmappedDocumentField[];
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

const toBooleanFlag = (value: any): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const n = value.trim().toLowerCase();
    return n === "1" || n === "true" || n === "y" || n === "yes";
  }
  return false;
};

export const mapScanForToSpecificationType = (
  scanFor: string | null,
): "MASTER" | "TRANSACTION" | null => {
  if (!scanFor) return null;
  const n = scanFor.trim().toUpperCase();
  if (n === "M") return "MASTER";
  if (n === "T") return "TRANSACTION";
  return null;
};

/** If code already taken, use `{code}-{uniqCode}` truncated to 50. */
export const disambiguateDocumentCode = (
  code: string,
  uniqCode: string | null,
  existingCodes: Set<string>,
): string => {
  const base = code.trim().toUpperCase().slice(0, DOCUMENT_CODE_MAX_LENGTH);
  if (!existingCodes.has(base)) {
    return base;
  }
  const suffix = (uniqCode ?? "X").trim().toUpperCase();
  const combined = `${base}-${suffix}`;
  if (combined.length <= DOCUMENT_CODE_MAX_LENGTH) {
    return combined;
  }
  const room = DOCUMENT_CODE_MAX_LENGTH - suffix.length - 1;
  if (room < 1) {
    return combined.slice(0, DOCUMENT_CODE_MAX_LENGTH);
  }
  return `${base.slice(0, room)}-${suffix}`;
};

export const mapLegacyScanDocMasterRow = (
  row: SourceRow,
): MappedScanDocMaster => {
  const oldId = toNullableString(row.nUniqCode ?? row.NUniqCode);
  const rawCode =
    toNullableString(row.vDocumentCode ?? row.VDocumentCode) ?? "";
  const documentCode = rawCode.toUpperCase();
  const documentDescription =
    toNullableString(row.vDocumentDesc ?? row.VDocumentDesc) ?? documentCode;
  const scanFor = toNullableString(row.vScanFor ?? row.VScanFor);
  const specificationType = mapScanForToSpecificationType(scanFor);
  const unmapped: UnmappedDocumentField[] = [];

  const renewalType = toNullableString(row.RenewalType ?? row.renewalType);
  if (renewalType) {
    unmapped.push({
      sourceColumn: "RenewalType",
      sourceValue: renewalType,
      reason: "No renewal field on document_profiles",
    });
  }
  const subType = toNullableString(row.vSubType ?? row.VSubType);
  if (subType) {
    unmapped.push({
      sourceColumn: "vSubType",
      sourceValue: subType,
      reason: "No sub-type column on document_profiles",
    });
  }

  let skipReason: string | null = null;
  if (!documentCode) {
    skipReason = "Missing vDocumentCode";
  } else if (!specificationType) {
    skipReason = `vScanFor '${scanFor ?? ""}' not M/T`;
  }

  return {
    oldId,
    documentCode,
    documentDescription,
    isRequired: toBooleanFlag(row.bIsRequired ?? row.BIsRequired),
    sortOrder: toNullableNumber(row.nPriority ?? row.NPriority) ?? 0,
    active: toBooleanFlag(row.bIsActive ?? row.BIsActive ?? 1),
    isDeleted: toBooleanFlag(row.bIsDeleted ?? row.BIsDeleted),
    specificationType,
    kycGroup: toNullableString(row.KYCGroup ?? row.kycGroup),
    scanType: toNullableString(row.vScanType ?? row.VScanType),
    kycYear: toNullableString(row.KYCYear ?? row.kycYear),
    renewalType,
    maxSizeMb: DOCUMENT_PROFILE_MAX_SIZE_MB_DEFAULT,
    documentType: [...DOCUMENT_PROFILE_TYPE_DEFAULT],
    skipReason,
    unmapped,
  };
};
