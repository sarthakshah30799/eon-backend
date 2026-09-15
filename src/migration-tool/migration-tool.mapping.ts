export type SourceRow = Record<string, any>;

export const BRANCH_CODE_LENGTH = 5;
export const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/i;
export const GSTIN_PATTERN =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/i;

export const toBoolean = (value: any): boolean => {
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

export const toNullableString = (value: any): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
};

export const toStringOrFallback = (value: any, fallback: string): string => {
  const resolved = toNullableString(value);
  return resolved ?? fallback;
};

export const toNullableDate = (value: any): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getUTCFullYear() <= 1900) return null;
  return date;
};

export const toNullableNumber = (value: any): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
};

export const pickSourceString = (
  row: SourceRow,
  keys: string[],
): string | null => {
  for (const key of keys) {
    const value = toNullableString(row[key]);
    if (value) {
      return value;
    }
  }
  return null;
};

export const extractPanFromLegacyTaxId = (
  value: any,
): { pan: string | null; kind: "pan" | "gstin" | "invalid" } => {
  const text = toNullableString(value)?.toUpperCase() ?? null;
  if (!text) {
    return { pan: null, kind: "invalid" };
  }
  if (PAN_PATTERN.test(text)) {
    return { pan: text, kind: "pan" };
  }
  if (
    GSTIN_PATTERN.test(text) ||
    (text.length === 15 && PAN_PATTERN.test(text.slice(2, 12)))
  ) {
    return { pan: text.slice(2, 12), kind: "gstin" };
  }
  return { pan: null, kind: "invalid" };
};

export const transformBranchCode = (
  row: SourceRow,
): {
  value: string;
  transformed: boolean;
  sourceField: string;
} => {
  const raw =
    toNullableString(row.Prefix) ||
    toNullableString(row.vBranchCode) ||
    "BRAN";
  const sourceField = toNullableString(row.Prefix) ? "Prefix" : "vBranchCode";
  const base = raw.trim().toUpperCase();
  if (base.length === BRANCH_CODE_LENGTH) {
    return {
      value: base,
      transformed: false,
      sourceField,
    };
  }

  if (base.length > BRANCH_CODE_LENGTH) {
    return {
      value: base.slice(0, BRANCH_CODE_LENGTH),
      transformed: true,
      sourceField,
    };
  }

  const padded = base
    .padEnd(BRANCH_CODE_LENGTH, "0")
    .slice(0, BRANCH_CODE_LENGTH);
  return { value: padded, transformed: true, sourceField };
};

export const isHeadOfficeBranchCode = (code: string): boolean =>
  code.replace(/0+$/, "") === "HO";

export type MappedCompanyRecord = {
  oldId: string | number | null;
  name: string;
  formerlyKnownName: string | null;
  cinNo: null;
  panNo: string;
  panKind: "pan" | "gstin" | "invalid";
  legacyTaxId: string | null;
  fxRegNo: string | null;
  aeonLicNo: string | null;
  fromDate: Date | null;
  toDate: Date | null;
  fxRegDate: Date | null;
  logo: string | null;
};

export const mapLegacyCompanyRecord = (row: SourceRow): MappedCompanyRecord => {
  const oldId = row.nCompID ?? row.ncompid ?? row.id ?? row.ID ?? null;
  const legacyTaxId = pickSourceString(row, [
    "cgstno",
    "cgstNo",
    "panNo",
    "PANNO",
  ]);
  const extractedPan = extractPanFromLegacyTaxId(legacyTaxId);
  const licenseNo = pickSourceString(row, [
    "VRBILICENCENUMBER",
    "VRBILICENSENUMBER",
    "vRBILicenceNumber",
    "vRBILicenseNumber",
  ]);
  const fromDate = toNullableDate(row.FROMDATE);

  return {
    oldId,
    name: toStringOrFallback(row.vCompanyName, `Company ${oldId}`),
    formerlyKnownName: toNullableString(row.VCOMPANYNAME2),
    cinNo: null,
    panNo: extractedPan.pan ?? `PAN_PENDING_${oldId}`,
    panKind: extractedPan.kind,
    legacyTaxId,
    fxRegNo: licenseNo,
    aeonLicNo: licenseNo,
    fromDate,
    toDate: toNullableDate(row.TODATE),
    fxRegDate: fromDate,
    logo: toNullableString(row.LOGOPATH),
  };
};

export type MappedBranchRecord = {
  oldId: string | number | null;
  companyOldId: string | number | null;
  code: string;
  codeTransformed: boolean;
  codeSourceField: string;
  name: string;
  city: string;
  pinCode: string;
  gstNo: string | null;
  fxRegNo: string | null;
  fxRegDate: Date | null;
  contactName: string | null;
  contactNo: string | null;
  branchEmail: string | null;
  locationTypeRaw: string | null;
  isHeadOffice: boolean;
  isActive: boolean;
};

export const mapLegacyBranchRecord = (row: SourceRow): MappedBranchRecord => {
  const oldId = row.nBranchID ?? row.nbranchid ?? row.id ?? row.ID ?? null;
  const transformedCode = transformBranchCode(row);
  return {
    oldId,
    companyOldId: row.nCompID ?? row.ncompid ?? null,
    code: transformedCode.value,
    codeTransformed: transformedCode.transformed,
    codeSourceField: transformedCode.sourceField,
    name: toStringOrFallback(
      row.vLocation || row.vCity || row.vBranchCode,
      `Branch ${oldId}`,
    ),
    city: toStringOrFallback(row.vCity, "UNKNOWN"),
    pinCode: toStringOrFallback(row.vPinCode, "000000"),
    gstNo: toNullableString(row.vServiceTaxRegNo),
    fxRegNo: toNullableString(row.vRBILicenseNo),
    fxRegDate: toNullableDate(row.dRBIRegDate),
    contactName: toNullableString(row.vContactPerson ?? row.vContactPeron),
    contactNo: toNullableString(
      row.vContactPersonNo ??
        row.vContactPeronNo ??
        row.vTelNo1 ??
        row.vTellNo1,
    ),
    branchEmail: toNullableString(row.vEmailID),
    locationTypeRaw: toNullableString(
      row.vLocationType ?? row.nLocationType ?? row.locationType,
    ),
    isHeadOffice:
      toBoolean(row.IsHubBranch) || isHeadOfficeBranchCode(transformedCode.value),
    isActive: toBoolean(row.bActive),
  };
};
