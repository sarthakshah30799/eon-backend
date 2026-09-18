import { ClientType } from "../party-profiles/party-profile.entity";
import { CategoryOptionCodeEnum } from "../category-options/category-option-code.enum";

export type SourceRow = Record<string, any>;

export const LEGACY_PARTY_TABLE_CANDIDATES = {
  mstCodes: ["mstCodes", "mstcodes", "MSTCODES"],
  productIssuerLink: [
    "mProductIssuerLink",
    "mproductissuerlink",
    "MPRODUCTISSUERLINK",
  ],
  mstCodesKyc: ["mstCODESKYC", "mstcodeskyc", "MSTCODESKYC"],
} as const;

/** High-confidence vType → ClientType. CQ-2 types are omitted (skipped). */
export const HIGH_CONFIDENCE_PARTY_TYPE_MAP: Record<string, ClientType> = {
  CC: ClientType.CORPORATE_CLIENT,
  TA: ClientType.AGENT,
  FF: ClientType.FFMC,
  ME: ClientType.MARKETING_EXECUTIVE,
  AD: ClientType.AUTHORISED_DEALER,
  FR: ClientType.FRANCHISE,
  TC: ClientType.CARD_ISSUER_PROFILE,
};

export const SKIP_PARTY_VTYPES = new Set(["GS", "BR"]);

/** Prefer migrating referenced parties before corporates that link to them. */
export const PARTY_MIGRATE_TYPE_ORDER = [
  "ME",
  "TA",
  "FF",
  "AD",
  "FR",
  "TC",
  "CC",
] as const;

export type UnmappedPartyField = {
  sourceColumn: string;
  sourceValue: string | number | boolean | null;
  reason: string;
};

export type MappedPartyCategoryRef = {
  code: CategoryOptionCodeEnum;
  value: string;
  sourceColumn: string;
};

export type MappedPartyProfile = {
  oldId: string | number | null;
  vType: string;
  clientType: ClientType | null;
  skipReason: string | null;
  code: string;
  name: string;
  address1: string;
  address2: string | null;
  address3: string | null;
  city: string;
  pinCode: string;
  phoneNo: string | null;
  email: string | null;
  webSite: string | null;
  contactName: string | null;
  designation: string | null;
  remarks: string | null;
  dateOfIntro: Date | null;
  establishmentDate: Date | null;
  blockDateFrom: Date | null;
  creditLimit: number | null;
  creditDays: number | null;
  temporaryCreditLimit: number | null;
  temporaryCreditDays: number | null;
  chqTrxnLimit: number | null;
  defaultHandlingCharges: number | null;
  panNo: string | null;
  accountHolderName: string | null;
  bankName: string | null;
  accountNumber: string | null;
  ifscCode: string | null;
  bankBranchName: string | null;
  ffmcRegNo: string | null;
  ffmcRegDate: Date | null;
  kycApprovalNumber: string | null;
  isIndividual: boolean;
  isTdsDeducted: boolean;
  tds: string | null;
  purchase: boolean;
  sale: boolean;
  printAddress: boolean;
  eefcClient: boolean;
  igstOnly: boolean;
  applyTax: boolean;
  active: boolean;
  isActive: boolean;
  cardNumberLength: number | null;
  allowCardNumberMasking: boolean;
  legacyBranchId: string | null;
  legacyBranchCode: string | null;
  legacyDefaultAgentCode: string | null;
  legacyMarketingExecutiveId: string | null;
  categoryRefs: MappedPartyCategoryRef[];
  unmapped: UnmappedPartyField[];
};

export type MappedProductIssuerLink = {
  productCode: string;
  legacyIssuerId: string;
  isActive: boolean;
  skipReason: string | null;
  unmapped: UnmappedPartyField[];
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

const toNullableDate = (value: any): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** Junk placeholder codes on category-like columns. */
export const isJunkCategoryCode = (value: string | null): boolean => {
  if (!value) return true;
  const normalized = value.trim();
  return normalized === "0" || normalized === "1";
};

export const isJunkMarketingExecutiveId = (
  value: string | number | null | undefined,
): boolean => {
  if (value === null || value === undefined || value === "") return true;
  const text = String(value).trim();
  return text === "0" || text === "1";
};

export const resolvePartyClientType = (
  vType: string | null,
): { clientType: ClientType | null; skipReason: string | null } => {
  if (!vType) {
    return { clientType: null, skipReason: "Missing vType" };
  }
  const key = vType.trim().toUpperCase();
  if (SKIP_PARTY_VTYPES.has(key)) {
    return {
      clientType: null,
      skipReason: `${key} is not a party master (skip)`,
    };
  }
  const mapped = HIGH_CONFIDENCE_PARTY_TYPE_MAP[key];
  if (!mapped) {
    return {
      clientType: null,
      skipReason: `vType ${key} deferred (CQ-2 / not high-confidence)`,
    };
  }
  return { clientType: mapped, skipReason: null };
};

const pushCategoryRef = (
  refs: MappedPartyCategoryRef[],
  unmapped: UnmappedPartyField[],
  code: CategoryOptionCodeEnum,
  sourceColumn: string,
  raw: any,
) => {
  const value = toNullableString(raw);
  if (!value) return;
  if (isJunkCategoryCode(value)) {
    unmapped.push({
      sourceColumn,
      sourceValue: value,
      reason: "Junk placeholder 0/1 treated as empty",
    });
    return;
  }
  refs.push({ code, value, sourceColumn });
};

export const mapLegacyPartyProfile = (row: SourceRow): MappedPartyProfile => {
  const unmapped: UnmappedPartyField[] = [];
  const categoryRefs: MappedPartyCategoryRef[] = [];
  const oldId = row.nCodesID ?? row.nCodesId ?? row.ncodesid ?? row.id ?? null;
  const vType = toNullableString(row.vType)?.toUpperCase() ?? "";
  const { clientType, skipReason } = resolvePartyClientType(vType || null);

  const code =
    toNullableString(row.vCode)?.toUpperCase() ??
    (oldId != null ? `PARTY_${oldId}` : "PARTY_UNKNOWN");
  const name = toNullableString(row.vName) ?? code;

  pushCategoryRef(
    categoryRefs,
    unmapped,
    CategoryOptionCodeEnum.KycRiskCategory,
    "vKYCRiskCategory",
    row.vKYCRiskCategory,
  );
  pushCategoryRef(
    categoryRefs,
    unmapped,
    CategoryOptionCodeEnum.EntityType,
    "vEntityType",
    row.vEntityType,
  );
  pushCategoryRef(
    categoryRefs,
    unmapped,
    CategoryOptionCodeEnum.BusinessNature,
    "vBusinessNature",
    row.vBusinessNature,
  );
  pushCategoryRef(
    categoryRefs,
    unmapped,
    CategoryOptionCodeEnum.Group,
    "vGrpcode",
    row.vGrpcode,
  );
  pushCategoryRef(
    categoryRefs,
    unmapped,
    CategoryOptionCodeEnum.TdsGroup,
    "vTDSGroup",
    row.vTDSGroup,
  );

  const defaultAgentRaw = toNullableString(row.vDefaultAgent);
  let legacyDefaultAgentCode: string | null = null;
  if (defaultAgentRaw) {
    if (isJunkCategoryCode(defaultAgentRaw)) {
      unmapped.push({
        sourceColumn: "vDefaultAgent",
        sourceValue: defaultAgentRaw,
        reason: "Junk placeholder 0/1 treated as empty",
      });
    } else {
      legacyDefaultAgentCode = defaultAgentRaw.toUpperCase();
    }
  }

  const meRaw = row.nMrktExecutive ?? row.nMrktExecutiveID;
  let legacyMarketingExecutiveId: string | null = null;
  if (meRaw !== null && meRaw !== undefined && meRaw !== "") {
    if (isJunkMarketingExecutiveId(meRaw)) {
      unmapped.push({
        sourceColumn: "nMrktExecutive",
        sourceValue: String(meRaw),
        reason: "Sentinel 0/1 treated as empty",
      });
    } else {
      legacyMarketingExecutiveId = String(meRaw);
    }
  }

  const isCardIssuer = clientType === ClientType.CARD_ISSUER_PROFILE;

  // Columns with no exact target (WU / TCS / FCRA / MSME blocks, etc.)
  const logIfPresent = (sourceColumn: string, value: any, reason: string) => {
    if (value === null || value === undefined || value === "") return;
    if (typeof value === "string" && !value.trim()) return;
    unmapped.push({
      sourceColumn,
      sourceValue:
        typeof value === "object" ? String(value) : (value as string | number | boolean),
      reason,
    });
  };
  logIfPresent("vFax", row.vFax, "No fax column on party_profiles");
  logIfPresent("vLocation", row.vLocation, "Location text not mapped this wave");
  logIfPresent("vState", row.vState, "State text; FK resolved separately when possible");
  logIfPresent("vRegion", row.vRegion, "No region column");
  logIfPresent("vDistrict", row.vDistrict, "No district column");
  logIfPresent("vWuParantCode", row.vWuParantCode, "WU fields out of scope");
  logIfPresent("TCSApply", row.TCSApply, "TCS block out of scope this wave");
  logIfPresent("ISMSME", row.ISMSME, "MSME block out of scope this wave");
  logIfPresent("FCRARegistered", row.FCRARegistered, "FCRA block out of scope this wave");

  return {
    oldId,
    vType,
    clientType,
    skipReason,
    code,
    name,
    address1: toNullableString(row.vAddress1) ?? "",
    address2: toNullableString(row.vAddress2),
    address3: toNullableString(row.vAddress3),
    city: toNullableString(row.vCity) ?? "",
    pinCode: toNullableString(row.vPinCode) ?? "",
    phoneNo: toNullableString(row.vPhone),
    email: toNullableString(row.vEmail),
    webSite: toNullableString(row.vWebsite),
    contactName: toNullableString(row.nContact),
    designation:
      toNullableString(row.vDesign) ?? toNullableString(row.vDESIG),
    remarks: toNullableString(row.Remarks),
    dateOfIntro: toNullableDate(row.dDATEINTRO ?? row.dIntdate),
    establishmentDate: toNullableDate(row.dEstblishDate),
    blockDateFrom: toNullableDate(row.dBlockDate ?? row.BlockedOn),
    creditLimit: toNullableNumber(row.nCREDITLIM),
    creditDays: toNullableNumber(row.nCREDITDAYS),
    temporaryCreditLimit: toNullableNumber(row.nAddCreditLimit),
    temporaryCreditDays: toNullableNumber(row.nAddCreditDays),
    chqTrxnLimit: toNullableNumber(row.nChqTxnlimt),
    defaultHandlingCharges: toNullableNumber(row.nHandlingCharges),
    panNo: toNullableString(row.vPan),
    accountHolderName: toNullableString(row.AccHolderName),
    bankName: toNullableString(row.BankName),
    accountNumber: toNullableString(row.AccNumber),
    ifscCode: toNullableString(row.IFSCCode),
    bankBranchName: toNullableString(row.BankAddress),
    ffmcRegNo: toNullableString(row.vRegno),
    ffmcRegDate: toNullableDate(row.dRegdate),
    kycApprovalNumber: toNullableString(row.vKYCApprovalNumber),
    isIndividual: toBoolean(row.bIND),
    isTdsDeducted: toBoolean(row.bTDSDED),
    tds:
      toNullableNumber(row.nTDSPER) != null
        ? String(toNullableNumber(row.nTDSPER))
        : null,
    purchase: toBoolean(row.bPurchaseParty),
    sale: toBoolean(row.bSaleParty),
    printAddress: toBoolean(row.bPrintAddress),
    eefcClient: toBoolean(row.bEEFCClient),
    igstOnly: toBoolean(row.bIGSTOnly),
    applyTax: toBoolean(row.bServiceTax),
    active: toBoolean(row.bActive),
    isActive: toBoolean(row.bActive),
    cardNumberLength: isCardIssuer ? 16 : null,
    allowCardNumberMasking: false,
    legacyBranchId:
      row.nBranchID != null && row.nBranchID !== ""
        ? String(row.nBranchID)
        : null,
    legacyBranchCode: toNullableString(row.vBranchCode),
    legacyDefaultAgentCode,
    legacyMarketingExecutiveId,
    categoryRefs,
    unmapped,
  };
};

export const mapLegacyProductIssuerLink = (
  row: SourceRow,
): MappedProductIssuerLink => {
  const unmapped: UnmappedPartyField[] = [];
  const productCode =
    toNullableString(row.PRODUCTCODE ?? row.ProductCode ?? row.vProductCode)?.toUpperCase() ??
    "";
  const legacyIssuerId = String(
    row.nIssuerID ?? row.nIssuerId ?? row.nissuerid ?? "",
  ).trim();
  const isActive = toBoolean(row.ISACTIVE ?? row.IsActive ?? row.bIsActive ?? 1);

  let skipReason: string | null = null;
  if (!productCode) {
    skipReason = "Missing PRODUCTCODE";
  } else if (!legacyIssuerId || legacyIssuerId === "0") {
    skipReason = "Missing nIssuerID";
  }

  if (row.ISACTIVE !== undefined && !isActive) {
    unmapped.push({
      sourceColumn: "ISACTIVE",
      sourceValue: row.ISACTIVE,
      reason: "Inactive link still inserted (join table has no active flag)",
    });
  }

  return {
    productCode,
    legacyIssuerId,
    isActive,
    skipReason,
    unmapped,
  };
};

export const sortPartyRowsForMigration = <T extends SourceRow>(
  rows: T[],
): T[] => {
  const orderIndex = new Map(
    PARTY_MIGRATE_TYPE_ORDER.map((type, index) => [type, index]),
  );
  return [...rows].sort((a, b) => {
    const aType = String(a.vType ?? "")
      .trim()
      .toUpperCase();
    const bType = String(b.vType ?? "")
      .trim()
      .toUpperCase();
    const aOrder = orderIndex.get(aType as (typeof PARTY_MIGRATE_TYPE_ORDER)[number]) ?? 99;
    const bOrder = orderIndex.get(bType as (typeof PARTY_MIGRATE_TYPE_ORDER)[number]) ?? 99;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return Number(a.nCodesID ?? 0) - Number(b.nCodesID ?? 0);
  });
};
