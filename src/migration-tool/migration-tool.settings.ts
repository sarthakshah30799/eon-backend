export type SourceRow = Record<string, any>;

export const PASSWORD_POLICY_MAX_LENGTH_DEFAULT = 128;
export const MAIL_PASSWORD_DUMMY_PLAINTEXT = "MIGRATE_RESET";
export const DAY_END_POLICY_CATEGORY_CODE = "DAY_END_POLICY";
export const PASSWORD_POLICY_CATEGORY_CODE = "PASSWORD_POLICY";

export const LEGACY_SETTINGS_TABLE_CANDIDATES = {
  advsettings: ["advsettings", "AdvSettings", "ADVSETTINGS"],
  mstPasswordPolicy: ["mstPasswordPolicy", "MstPasswordPolicy", "MSTPASSWORDPOLICY"],
  mailConfig: ["MailConfig", "mailconfig", "MAILCONFIG"],
  tbEodQuestion: ["tb_EODQuestion", "TB_EODQUESTION", "tb_eodquestion"],
  updateSettings: ["UpdateSettings", "updatesettings", "UPDATESETTINGS"],
  tbConsoParameter: ["tb_ConsoParameter", "TB_CONSOPARAMETER", "tb_consoparameter"],
  docCheck: ["DOCCHECK", "DocCheck", "doccheck"],
  yrMaster: ["yrMaster", "YrMaster", "YRMASTER"],
  yrDetails: ["yrDetails", "YrDetails", "YRDETAILS"],
  scannedDocs: ["ScannedDocs", "scanneddocs", "SCANNEDDOCS"],
  preScannedDocs: ["PreScannedDocs", "prescanneddocs", "PRESCANNEDDOCS"],
  docCollected: ["DOCCOLLECTED", "DocCollected", "doccollected"],
  payDataLock: ["PAYDATALOCK", "PayDataLock", "paydatalock"],
  mlRecord: ["MLRECORD", "MLRecord", "mlrecord"],
  restrictedMenuVsCounter: [
    "tb_RestrictedMenuVsCounter",
    "TB_RESTRICTEDMENUVSCOUNTER",
  ],
  holidayList: ["tb_HolidayList", "TB_HOLIDAYLIST"],
  mstShifts: ["mstShifts", "MstShifts", "MSTSHIFTS"],
  mstUserLogin: ["mstUserLogin", "MstUserLogin"],
  mstUserLogonHours: ["mstUserLogonHours", "MstUserLogonHours"],
  logUserLogin: ["LOGUSERLOGIN", "LogUserLogin"],
} as const;

export const SETTINGS_MIGRATION_SKIPPED_TABLES = [
  {
    table: "DOCCHECK",
    reason:
      "Purpose×txn compulsory doc rules — no document_profiles fields. CQ-wave7.",
  },
  {
    table: "UpdateSettings",
    reason: "Access/reupdate password flags — not additional settings.",
  },
  {
    table: "tb_ConsoParameter",
    reason: "Empty / consoli params — skip.",
  },
  {
    table: "yrMaster",
    reason: "Legacy FY header — skip this wave.",
  },
  {
    table: "yrDetails",
    reason: "Yearly DB names — future (not this wave).",
  },
  {
    table: "ScannedDocs",
    reason: "Txn/party file metadata — txn-later.",
  },
  {
    table: "PreScannedDocs",
    reason: "Txn/party file metadata — txn-later.",
  },
  {
    table: "DOCCOLLECTED",
    reason: "Txn doc collection flags — txn-later.",
  },
  {
    table: "PAYDATALOCK",
    reason: "Pay reference lock list — txn-later.",
  },
  {
    table: "MLRECORD",
    reason: "Table missing in sample — CQ if prod has data.",
  },
  {
    table: "tb_RestrictedMenuVsCounter",
    reason: "Empty in sample — CQ if prod has data.",
  },
  {
    table: "tb_HolidayList",
    reason: "No holiday entity — skip.",
  },
  {
    table: "mstShifts",
    reason: "No shift entity — skip.",
  },
  {
    table: "mstUserLogin",
    reason: "Session login log — skip.",
  },
  {
    table: "mstUserLogonHours",
    reason: "Logon-hour grid — skip.",
  },
  {
    table: "LOGUSERLOGIN",
    reason: "Login log — skip.",
  },
] as const;

/** Reserved PASSWORD_* children — owned by mstPasswordPolicy, not advsettings PWD*. */
export const PASSWORD_POLICY_CHILD_CODES = [
  "PASSWORD_POLICY",
  "PASSWORD_MIN_LENGTH",
  "PASSWORD_MAX_LENGTH",
  "PASSWORD_MIN_SPECIAL_CHAR_COUNT",
  "PASSWORD_MIN_NUMERIC_CHAR_COUNT",
  "PASSWORD_MIN_ALPHA_CHAR_COUNT",
  "PASSWORD_MAX_INVALID_ATTEMPTS",
] as const;

export type AdvSettingValueType =
  | "boolean"
  | "number"
  | "decimal"
  | "date"
  | "text";

export type InferredAdvSettingValue = {
  valueType: AdvSettingValueType;
  valueBoolean: boolean | null;
  valueNumber: number | null;
  valueDecimal: number | null;
  valueDate: Date | null;
  valueText: string | null;
  looksLikeEntityRef: boolean;
};

export type CollapsedAdvSetting = {
  dataCode: string;
  label: string;
  categoryRaw: string | null;
  categoryCode: string;
  dataTypeRaw: string | null;
  dataValueRaw: string | null;
  nBranchId: string | null;
  sourceId: number;
  inferred: InferredAdvSettingValue;
};

export type AdvSettingDuplicateSkip = {
  dataCode: string;
  sourceId: number;
  lostValue: string | null;
  reason: string;
};

export type MappedPasswordPolicy = {
  minLength: number;
  maxLength: number;
  minAlphaCount: number;
  minNumericCount: number;
  minSpecialCharCount: number;
  expDateDays: number | null;
  unmapped: Array<{ sourceColumn: string; sourceValue: string | number | null; reason: string }>;
};

export type MappedMailConfig = {
  oldId: string | null;
  username: string;
  host: string;
  port: number;
  senderEmail: string | null;
  fromMailId: string | null;
  enableSsl: boolean | null;
  /** Always dummy — never source password. */
  passwordPlaintext: typeof MAIL_PASSWORD_DUMMY_PLAINTEXT;
  sourcePasswordPresent: boolean;
  skipReason: string | null;
  unmapped: Array<{ sourceColumn: string; sourceValue: string | number | null; reason: string }>;
};

export type MappedEodQuestion = {
  oldId: string | null;
  code: string;
  label: string;
  isActive: boolean;
  skipReason: string | null;
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

export const isPasswordPolicyChildCode = (code: string | null): boolean => {
  if (!code) return false;
  const normalized = code.trim().toUpperCase();
  return (PASSWORD_POLICY_CHILD_CODES as readonly string[]).includes(
    normalized,
  );
};

export const normalizeSettingCategoryCode = (
  raw: string | null | undefined,
): string => {
  const text = toNullableString(raw);
  if (!text) return "GENERAL_OPTIONS";
  return text
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_]/g, "")
    .toUpperCase() || "GENERAL_OPTIONS";
};

const isYesNoToken = (text: string): boolean => {
  const n = text.trim().toLowerCase();
  return (
    n === "yes" ||
    n === "no" ||
    n === "y" ||
    n === "n" ||
    n === "true" ||
    n === "false"
  );
};

const parseYesNo = (text: string): boolean => {
  const n = text.trim().toLowerCase();
  return n === "yes" || n === "y" || n === "true" || n === "1";
};

const looksLikeDate = (text: string): boolean => {
  if (/^\d{1,2}[-/][A-Za-z]{3}[-/]\d{2,4}$/.test(text)) return true;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return true;
  const d = Date.parse(text);
  return !Number.isNaN(d) && /[A-Za-z-]/.test(text);
};

/**
 * Heuristic: entity-like codes are short alphanumeric tokens, not yes/no or pure numbers.
 */
export const looksLikeEntityReference = (raw: string | null): boolean => {
  if (!raw) return false;
  const text = raw.trim();
  if (!text || isYesNoToken(text)) return false;
  if (/^-?\d+(\.\d+)?$/.test(text)) return false;
  if (looksLikeDate(text)) return false;
  if (text.includes("@")) return false;
  if (text.length > 64) return false;
  return /^[A-Za-z0-9][A-Za-z0-9_\-.]*$/.test(text);
};

/** Infer typed value from DATAVALUE (W7-8) — ignore misleading DATATYPE=B. */
export const inferAdvSettingValue = (
  dataValue: any,
): InferredAdvSettingValue => {
  const empty: InferredAdvSettingValue = {
    valueType: "text",
    valueBoolean: null,
    valueNumber: null,
    valueDecimal: null,
    valueDate: null,
    valueText: null,
    looksLikeEntityRef: false,
  };

  const text = toNullableString(dataValue);
  if (text === null) {
    return empty;
  }

  if (isYesNoToken(text)) {
    return {
      ...empty,
      valueType: "boolean",
      valueBoolean: parseYesNo(text),
      valueText: text,
    };
  }

  if (/^-?\d+$/.test(text)) {
    return {
      ...empty,
      valueType: "number",
      valueNumber: Number(text),
      valueText: text,
    };
  }

  if (/^-?\d+\.\d+$/.test(text)) {
    return {
      ...empty,
      valueType: "decimal",
      valueDecimal: Number(text),
      valueText: text,
    };
  }

  if (looksLikeDate(text)) {
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return {
        ...empty,
        valueType: "date",
        valueDate: parsed,
        valueText: text,
      };
    }
  }

  const entity = looksLikeEntityReference(text);
  return {
    ...empty,
    valueType: "text",
    valueText: text,
    looksLikeEntityRef: entity,
  };
};

export const collapseAdvSettingsByDataCode = (
  rows: SourceRow[],
): {
  kept: CollapsedAdvSetting[];
  skippedDuplicates: AdvSettingDuplicateSkip[];
} => {
  const indexed = rows
    .map((row) => {
      const dataCode = toNullableString(row.DATACODE ?? row.DataCode ?? row.datacode);
      const idRaw = row.ID ?? row.Id ?? row.id ?? row.nUniqCode;
      const sourceId = toNullableNumber(idRaw);
      return { row, dataCode, sourceId: sourceId ?? Number.MAX_SAFE_INTEGER };
    })
    .filter((item) => item.dataCode)
    .sort((a, b) => a.sourceId - b.sourceId);

  const seen = new Set<string>();
  const kept: CollapsedAdvSetting[] = [];
  const skippedDuplicates: AdvSettingDuplicateSkip[] = [];

  for (const item of indexed) {
    const code = item.dataCode!.toUpperCase();
    const dataValueRaw = toNullableString(
      item.row.DATAVALUE ?? item.row.DataValue ?? item.row.datavalue,
    );
    if (seen.has(code)) {
      skippedDuplicates.push({
        dataCode: code,
        sourceId: item.sourceId,
        lostValue: dataValueRaw,
        reason: "Duplicate DATACODE — first wins (lowest ID)",
      });
      continue;
    }
    seen.add(code);

    const categoryRaw = toNullableString(
      item.row.SETTINGCATEGORY ??
        item.row.SettingCategory ??
        item.row.settingcategory,
    );
    const label =
      toNullableString(
        item.row.DATADISPLAY ?? item.row.DataDisplay ?? item.row.datadisplay,
      ) ?? code;

    kept.push({
      dataCode: code,
      label,
      categoryRaw,
      categoryCode: normalizeSettingCategoryCode(categoryRaw),
      dataTypeRaw: toNullableString(
        item.row.DATATYPE ?? item.row.DataType ?? item.row.datatype,
      ),
      dataValueRaw,
      nBranchId: toNullableString(
        item.row.nBranchID ?? item.row.NBRANCHID ?? item.row.nbranchid,
      ),
      sourceId: item.sourceId,
      inferred: inferAdvSettingValue(dataValueRaw),
    });
  }

  return { kept, skippedDuplicates };
};

export const mapPasswordPolicyRow = (row: SourceRow): MappedPasswordPolicy => {
  const minLength = toNullableNumber(row.nMinLength ?? row.NMinLength) ?? 8;
  const minAlpha =
    toNullableNumber(row.nNumAlphabets ?? row.nNumAlphabet) ?? 0;
  const minNumeric = toNullableNumber(row.nNumNumeric) ?? 0;
  const minSpecial = toNullableNumber(row.nNumSpChar) ?? 0;
  const expDateDays = toNullableNumber(row.nExpDate);
  const unmapped: MappedPasswordPolicy["unmapped"] = [];
  if (expDateDays !== null) {
    unmapped.push({
      sourceColumn: "nExpDate",
      sourceValue: expDateDays,
      reason: "No password expiry setting — CQ-wave7; log only",
    });
  }
  return {
    minLength,
    maxLength: PASSWORD_POLICY_MAX_LENGTH_DEFAULT,
    minAlphaCount: minAlpha,
    minNumericCount: minNumeric,
    minSpecialCharCount: minSpecial,
    expDateDays,
    unmapped,
  };
};

export const mapMailConfigRow = (row: SourceRow): MappedMailConfig => {
  const username =
    toNullableString(row.vSmtpUser ?? row.VSmtpUser ?? row.vsmtpuser) ?? "";
  const host =
    toNullableString(row.vSmtpServer ?? row.VSmtpServer ?? row.vsmtpserver) ??
    "";
  const port = toNullableNumber(row.vSmtpPort ?? row.VSmtpPort) ?? 0;
  const sourcePassword = toNullableString(
    row.vSmtpPassword ?? row.VSmtpPassword ?? row.vsmtppassword,
  );
  const unmapped: MappedMailConfig["unmapped"] = [];
  if (row.bEnablessl !== undefined && row.bEnablessl !== null) {
    unmapped.push({
      sourceColumn: "bEnablessl",
      sourceValue: row.bEnablessl,
      reason: "No SSL column on mail_configurations",
    });
  }

  let skipReason: string | null = null;
  if (!username || !host || !port) {
    skipReason = "Missing username, host, or port";
  }

  return {
    oldId: toNullableString(row.nMailConfig ?? row.NMailConfig),
    username,
    host,
    port,
    senderEmail: toNullableString(
      row.vFromMailid ?? row.VFromMailid ?? row.vfrommailid,
    ),
    fromMailId: toNullableString(
      row.vFromMailid ?? row.VFromMailid ?? row.vfrommailid,
    ),
    enableSsl:
      row.bEnablessl === undefined || row.bEnablessl === null
        ? null
        : toBooleanFlag(row.bEnablessl),
    passwordPlaintext: MAIL_PASSWORD_DUMMY_PLAINTEXT,
    sourcePasswordPresent: Boolean(sourcePassword),
    skipReason,
    unmapped,
  };
};

export const mapEodQuestionRow = (row: SourceRow): MappedEodQuestion => {
  const oldId = toNullableString(row.ID ?? row.Id ?? row.id);
  const label = toNullableString(row.Questions ?? row.questions);
  if (!oldId || !label) {
    return {
      oldId,
      code: "",
      label: label ?? "",
      isActive: false,
      skipReason: "Missing ID or Questions",
    };
  }
  return {
    oldId,
    code: `EOD_Q_${oldId}`,
    label,
    isActive: toBooleanFlag(row.IsActive ?? row.isActive ?? 1),
    skipReason: null,
  };
};
