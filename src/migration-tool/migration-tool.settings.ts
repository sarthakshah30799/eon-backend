export type SourceRow = Record<string, any>;

export const PASSWORD_POLICY_MAX_LENGTH_DEFAULT = 128;
export const MAIL_PASSWORD_DUMMY_PLAINTEXT = "MIGRATE_RESET";
export const DAY_END_POLICY_CATEGORY_CODE = "DAY_END_POLICY";
export const PASSWORD_POLICY_CATEGORY_CODE = "PASSWORD_POLICY";

export const LEGACY_SETTINGS_TABLE_CANDIDATES = {
  advsettings: ["advsettings", "AdvSettings", "ADVSETTINGS"],
  mstPasswordPolicy: [
    "mstPasswordPolicy",
    "MstPasswordPolicy",
    "MSTPASSWORDPOLICY",
  ],
  mailConfig: ["MailConfig", "mailconfig", "MAILCONFIG"],
  tbEodQuestion: ["tb_EODQuestion", "TB_EODQUESTION", "tb_eodquestion"],
  updateSettings: ["UpdateSettings", "updatesettings", "UPDATESETTINGS"],
  tbConsoParameter: [
    "tb_ConsoParameter",
    "TB_CONSOPARAMETER",
    "tb_consoparameter",
  ],
  docCheck: ["DOCCHECK", "DocCheck", "doccheck"],
  yrMaster: ["yrMaster", "YrMaster", "YRMASTER"],
  yrDetails: ["yrDetails", "YrDetails", "YRDETAILS"],
  scannedDocs: ["ScannedDocs", "scanneddocs", "SCANNEDDOCS"],
  preScannedDocs: ["PreScannedDocs", "prescanneddocs", "PRESCANNEDDOCS"],
  docCollected: ["DOCCOLLECTED", "DocCollected", "doccollected"],
  payDataLock: ["PAYDATALOCK", "PayDataLock", "paydatalock"],
  holidays: ["tb_HolidayList", "TB_HOLIDAYLIST", "tb_holidaylist"],
  shifts: ["mstShifts", "MstShifts", "MSTSHIFTS"],
  logUserLogin: ["LOGUSERLOGIN", "LogUserLogin", "loguserlogin"],
  mstUserLogin: ["mstUserLogin", "MstUserLogin", "MSTUSERLOGIN"],
  mlRecord: ["MLRECORD", "MLRecord", "mlrecord"],
  restrictedMenu: [
    "tb_RestrictedMenuVsCounter",
    "TB_RESTRICTEDMENUVSCOUNTER",
    "tb_restrictedmenuvscounter",
  ],
} as const;

/** Deferred / skip / txn-later settings-family tables — logged when selected. */
export const SETTINGS_MIGRATION_SKIPPED_TABLES = [
  {
    table: "DOCCHECK",
    reason:
      "Purpose×txn document checklist — no purpose×txn fields on document_profiles. CQ-wave7 skip/log.",
  },
  {
    table: "UpdateSettings",
    reason: "Ops reupdate flags / access codes — not advanced_settings. Skip/log.",
  },
  {
    table: "tb_ConsoParameter",
    reason: "Consolidated params — no matching master. Skip/log.",
  },
  {
    table: "yrMaster",
    reason: "Financial year master — skip this wave.",
  },
  {
    table: "yrDetails",
    reason: "Yearly DB name mapping — future. Not this wave.",
  },
  {
    table: "ScannedDocs",
    reason: "Scanned file blobs / txn docs — txn-later after headers exist.",
  },
  {
    table: "PreScannedDocs",
    reason: "Pre-scanned file store — txn-later.",
  },
  {
    table: "DOCCOLLECTED",
    reason: "Collected-doc txn log — txn-later.",
  },
  {
    table: "PAYDATALOCK",
    reason: "Payment date lock — txn/ops later; not monthly_lock_windows.",
  },
  {
    table: "tb_HolidayList",
    reason: "Holiday calendar — no holiday entity this wave. Skip.",
  },
  {
    table: "mstShifts",
    reason: "Shift master — no shift entity this wave. Skip.",
  },
  {
    table: "LOGUSERLOGIN",
    reason: "Login audit log — skip.",
  },
  {
    table: "mstUserLogin",
    reason: "User login history — skip.",
  },
  {
    table: "MLRECORD",
    reason: "Month-lock history — CQ-wave7 if nonempty in prod; skip/log.",
  },
  {
    table: "tb_RestrictedMenuVsCounter",
    reason:
      "Old counter menu rights — CQ-wave7 if nonempty; counter_menu_restrictions later.",
  },
] as const;

export type UnmappedSettingsField = {
  sourceColumn: string;
  sourceValue: string | number | boolean | null;
  reason: string;
};

const PASSWORD_POLICY_CHILD_CODES = new Set([
  "PASSWORD_MIN_LENGTH",
  "PASSWORD_MAX_LENGTH",
  "PASSWORD_MIN_SPECIAL_CHAR_COUNT",
  "PASSWORD_MIN_NUMERIC_CHAR_COUNT",
  "PASSWORD_MIN_ALPHA_CHAR_COUNT",
  "PASSWORD_MAX_INVALID_ATTEMPTS",
]);

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

const isBooleanLiteral = (text: string): boolean => {
  const normalized = text.trim().toLowerCase();
  return (
    normalized === "yes" ||
    normalized === "no" ||
    normalized === "y" ||
    normalized === "n" ||
    normalized === "true" ||
    normalized === "false"
  );
};

const parseBooleanLiteral = (text: string): boolean => {
  const normalized = text.trim().toLowerCase();
  return (
    normalized === "yes" ||
    normalized === "y" ||
    normalized === "true" ||
    normalized === "1"
  );
};

const looksLikeDate = (text: string): Date | null => {
  const trimmed = text.trim();
  if (!/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(trimmed) && !/^\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(trimmed)) {
    return null;
  }
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Heuristic: alphanumeric master-code shape (not yes/no, not pure number).
 * Service uses this to run the entity resolve chain before falling back to text.
 */
const looksLikeCodeRef = (text: string): boolean => {
  const trimmed = text.trim();
  if (!trimmed || isBooleanLiteral(trimmed)) return false;
  if (/^[+-]?\d+(\.\d+)?$/.test(trimmed)) return false;
  if (looksLikeDate(trimmed)) return false;
  if (/[\\/\s]/.test(trimmed)) return false;
  return /^[A-Za-z][A-Za-z0-9._-]{0,63}$/.test(trimmed);
};

/** "General Options" / "PASSWORD POLICY" → GENERAL_OPTIONS / PASSWORD_POLICY. */
export const normalizeSettingCategoryCode = (
  raw: string | null | undefined,
): string | null => {
  const text = toNullableString(raw);
  if (!text) return null;
  const normalized = text
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .toUpperCase();
  return normalized.length > 0 ? normalized : null;
};

export type InferredAdvSettingValue = {
  valueType: "boolean" | "number" | "decimal" | "date" | "text";
  valueBoolean?: boolean;
  valueNumber?: number;
  valueDecimal?: number;
  valueDate?: Date;
  valueText?: string;
  looksLikeEntityRef: boolean;
};

/** Type from DATAVALUE (not blind DATATYPE). */
export const inferAdvSettingValue = (
  dataValue: any,
): InferredAdvSettingValue => {
  if (dataValue === null || dataValue === undefined) {
    return { valueType: "text", valueText: "", looksLikeEntityRef: false };
  }

  if (typeof dataValue === "boolean") {
    return {
      valueType: "boolean",
      valueBoolean: dataValue,
      looksLikeEntityRef: false,
    };
  }

  if (typeof dataValue === "number" && Number.isFinite(dataValue)) {
    if (Number.isInteger(dataValue)) {
      return {
        valueType: "number",
        valueNumber: dataValue,
        looksLikeEntityRef: false,
      };
    }
    return {
      valueType: "decimal",
      valueDecimal: dataValue,
      looksLikeEntityRef: false,
    };
  }

  const text = String(dataValue).trim();
  if (!text) {
    return { valueType: "text", valueText: "", looksLikeEntityRef: false };
  }

  if (isBooleanLiteral(text)) {
    return {
      valueType: "boolean",
      valueBoolean: parseBooleanLiteral(text),
      looksLikeEntityRef: false,
    };
  }

  const asDate = looksLikeDate(text);
  if (asDate) {
    return {
      valueType: "date",
      valueDate: asDate,
      looksLikeEntityRef: false,
    };
  }

  if (/^[+-]?\d+$/.test(text)) {
    return {
      valueType: "number",
      valueNumber: Number(text),
      looksLikeEntityRef: false,
    };
  }

  if (/^[+-]?\d+\.\d+$/.test(text)) {
    return {
      valueType: "decimal",
      valueDecimal: Number(text),
      looksLikeEntityRef: false,
    };
  }

  const entityRef = looksLikeCodeRef(text);
  return {
    valueType: "text",
    valueText: text,
    looksLikeEntityRef: entityRef,
  };
};

export type CollapsedAdvSettingRow = {
  dataCode: string;
  row: SourceRow;
  id: number;
};

export type SkippedAdvSettingDuplicate = {
  dataCode: string;
  row: SourceRow;
  id: number;
  keptId: number;
  lostDataValue: string | null;
  reason: string;
};

/**
 * First DATACODE wins (lowest numeric ID). Does not filter by nBranchID —
 * branch=1 TCS keys are kept when they are the first for that code.
 */
export const collapseAdvSettingsByDataCode = (
  rows: SourceRow[],
): {
  kept: CollapsedAdvSettingRow[];
  skippedDuplicates: SkippedAdvSettingDuplicate[];
} => {
  const indexed = rows
    .map((row) => {
      const dataCode = toNullableString(
        row.DATACODE ?? row.DataCode ?? row.datacode,
      );
      const idRaw = row.ID ?? row.Id ?? row.id;
      const id = toNullableNumber(idRaw);
      return { row, dataCode, id };
    })
    .filter(
      (item): item is { row: SourceRow; dataCode: string; id: number } =>
        item.dataCode != null && item.id != null,
    )
    .sort((a, b) => a.id - b.id || a.dataCode.localeCompare(b.dataCode));

  const byCode = new Map<string, CollapsedAdvSettingRow>();
  const skippedDuplicates: SkippedAdvSettingDuplicate[] = [];

  for (const item of indexed) {
    const existing = byCode.get(item.dataCode);
    if (!existing) {
      byCode.set(item.dataCode, {
        dataCode: item.dataCode,
        row: item.row,
        id: item.id,
      });
      continue;
    }
    skippedDuplicates.push({
      dataCode: item.dataCode,
      row: item.row,
      id: item.id,
      keptId: existing.id,
      lostDataValue: toNullableString(
        item.row.DATAVALUE ?? item.row.DataValue ?? item.row.datavalue,
      ),
      reason: `Duplicate DATACODE ${item.dataCode}; kept lowest ID ${existing.id}`,
    });
  }

  return {
    kept: [...byCode.values()].sort((a, b) => a.id - b.id),
    skippedDuplicates,
  };
};

/** True for PASSWORD_* child codes — advsettings PWD* must not write these. */
export const isPasswordPolicyChildCode = (
  code: string | null | undefined,
): boolean => {
  const normalized = toNullableString(code)?.toUpperCase() ?? null;
  if (!normalized) return false;
  return PASSWORD_POLICY_CHILD_CODES.has(normalized);
};

export type MappedPasswordPolicyRow = {
  minLength: number | null;
  minAlpha: number | null;
  minNumeric: number | null;
  minSpecial: number | null;
  maxLength: number;
  expDate: number | null;
  unmapped: UnmappedSettingsField[];
};

export const mapPasswordPolicyRow = (
  row: SourceRow,
): MappedPasswordPolicyRow => {
  const unmapped: UnmappedSettingsField[] = [];
  const minLength = toNullableNumber(row.nMinLength ?? row.NMinLength);
  const minAlpha = toNullableNumber(row.nNumAlphabets ?? row.NNumAlphabets);
  const minNumeric = toNullableNumber(row.nNumNumeric ?? row.NNumNumeric);
  const minSpecial = toNullableNumber(row.nNumSpChar ?? row.NNumSpChar);
  const expDate = toNullableNumber(row.nExpDate ?? row.NExpDate);

  if (expDate != null) {
    unmapped.push({
      sourceColumn: "nExpDate",
      sourceValue: expDate,
      reason: "Password expiry days — no PASSWORD_* child; CQ-wave7",
    });
  }

  return {
    minLength,
    minAlpha,
    minNumeric,
    minSpecial,
    maxLength: PASSWORD_POLICY_MAX_LENGTH_DEFAULT,
    expDate,
    unmapped,
  };
};

export type MappedMailConfigRow = {
  oldId: string | null;
  username: string | null;
  host: string | null;
  port: number | null;
  senderEmail: string | null;
  passwordPlaintext: string;
  skipReason: string | null;
  unmapped: UnmappedSettingsField[];
};

export const mapMailConfigRow = (row: SourceRow): MappedMailConfigRow => {
  const unmapped: UnmappedSettingsField[] = [];
  const username = toNullableString(
    row.vSmtpUser ?? row.VSmtpUser ?? row.username,
  );
  const host = toNullableString(
    row.vSmtpServer ?? row.VSmtpServer ?? row.host,
  );
  const port = toNullableNumber(row.vSmtpPort ?? row.VSmtpPort ?? row.port);
  const senderEmail = toNullableString(
    row.vFromMailid ?? row.VFromMailid ?? row.senderEmail ?? row.from,
  );
  const sourcePassword = toNullableString(
    row.vSmtpPassword ?? row.VSmtpPassword ?? row.password,
  );

  if (sourcePassword) {
    unmapped.push({
      sourceColumn: "vSmtpPassword",
      sourceValue: "[redacted]",
      reason:
        "Never copy live SMTP secrets; passwordPlaintext is MIGRATE_RESET for service encrypt",
    });
  }

  const sslRaw = row.bEnablessl ?? row.BEnableSsl ?? row.ssl;
  if (sslRaw !== null && sslRaw !== undefined && sslRaw !== "") {
    unmapped.push({
      sourceColumn: "bEnablessl",
      sourceValue: sslRaw,
      reason: "mail_configurations has no SSL column; logged unmapped",
    });
  }

  let skipReason: string | null = null;
  if (!username || !host || port === null) {
    skipReason = "Missing vSmtpUser, vSmtpServer, or vSmtpPort";
  }

  return {
    oldId:
      row.nMailConfig != null && row.nMailConfig !== ""
        ? String(row.nMailConfig)
        : null,
    username,
    host,
    port,
    senderEmail,
    passwordPlaintext: MAIL_PASSWORD_DUMMY_PLAINTEXT,
    skipReason,
    unmapped,
  };
};

export type MappedEodQuestionRow = {
  oldId: string | null;
  code: string | null;
  label: string | null;
  active: boolean;
  skipReason: string | null;
};

export const mapEodQuestionRow = (row: SourceRow): MappedEodQuestionRow => {
  const oldId =
    row.ID != null && row.ID !== ""
      ? String(row.ID)
      : row.Id != null && row.Id !== ""
        ? String(row.Id)
        : null;
  const label = toNullableString(row.Questions ?? row.questions ?? row.label);
  const active = toBoolean(
    row.IsActive ?? row.isActive ?? row.active ?? 1,
  );

  if (!oldId) {
    return {
      oldId: null,
      code: null,
      label,
      active,
      skipReason: "Missing EOD question ID",
    };
  }

  return {
    oldId,
    code: `EOD_Q_${oldId}`,
    label,
    active,
    skipReason: label ? null : "Missing Questions label",
  };
};
