export type SourceRow = Record<string, any>;

export const LEGACY_PURPOSE_TABLE_CANDIDATES = {
  mstPurpose: ["mstPurpose", "MstPurpose", "MSTPURPOSE"],
  mstAppPurpose: ["mstAppPurpose", "MstAppPurpose", "MSTAPPPURPOSE"],
  subPurpose: ["SubPurpose", "subpurpose", "SUBPURPOSE"],
  purposeLimit: ["PurposeLimit", "purposelimit", "PURPOSELIMIT"],
  adiPurposeMaster: ["ADIPurposeMaster", "adipurposemaster", "ADIPURPOSEMASTER"],
  ad1ReferralInc: ["AD1Referral_Inc", "ad1referral_inc", "AD1REFERRAL_INC"],
  ibPurposes: ["IBPurposes", "ibpurposes", "IBPURPOSES"],
  rbiPurpose: ["RBIPurpose", "RBIPURPOSE", "rbipurpose"],
  mstLrsPurpose: ["MstLRSPurpose", "MSTLRSPurpose", "mstlrspurpose"],
  tpPurpose: ["TPPurpose", "tppurpose", "TPPURPOSE"],
  ttPurpose: ["TTPurpose", "ttpurpose", "TTPURPOSE"],
  ttSubPurpose: ["TTSubPurpose", "TTSubpurpose", "ttsubpurpose"],
} as const;

/** Non-operational / deferred purpose catalogs — logged when selected. */
export const PURPOSE_MIGRATION_SKIPPED_TABLES = [
  {
    table: "mstAppPurpose",
    reason:
      "UI view permissions (Master/Txn/Report), not purchase/sale purpose master.",
  },
  {
    table: "SubPurpose",
    reason:
      "1:1 mirror of mstPurpose labels; new schema has no sub-purpose entity (not purpose_slabs).",
  },
  {
    table: "PurposeLimit",
    reason:
      "Cash/FX per-visit/year caps. New purposes.threshold / purpose_slabs are TCS-only. Ask client (CQ-purpose-limits) before mapping.",
  },
  {
    table: "ADIPurposeMaster",
    reason:
      "ADI remittance text catalog overlapping mstPurpose letters; AD1 uses the same purposes table. Enrichment only — not a second master this wave.",
  },
  {
    table: "AD1Referral_Inc",
    reason: "Transaction log table (empty sample); not a purpose master.",
  },
  {
    table: "IBPurposes",
    reason:
      "Settlement/division buckets (CARD/TT/WU…), not travel/FX purpose catalog.",
  },
  {
    table: "RBIPurpose",
    reason:
      "Maps internal code → RBICODE (S0306…). No RBICODE column on purposes; log unmapped until schema/client decides.",
  },
  {
    table: "MstLRSPurpose",
    reason:
      "LRS-only list with duplicate codes; no separate LRS purpose entity. Deferred.",
  },
  {
    table: "TPPurpose",
    reason: "Empty sample; skip.",
  },
  {
    table: "TTPurpose",
    reason:
      "TT/TP/EM product purposes; new app has one purposes master from mstPurpose. Deferred until TT wave.",
  },
  {
    table: "TTSubPurpose",
    reason:
      "Subcodes up to 6 chars (GICCAN, UFEE…); no sub-purpose table and not TCS purpose_slabs.",
  },
] as const;

export type UnmappedPurposeField = {
  sourceColumn: string;
  sourceValue: string | number | boolean | null;
  reason: string;
};

export type MappedMstPurposeRow = {
  oldId: string | null;
  legacyPurposeCode: string | null;
  description: string;
  descriptionKey: string;
  sell: boolean;
  purchase: boolean;
  corporate: boolean;
  individual: boolean;
  isActive: boolean;
  isDeleted: boolean;
  statutoryCode: string | null;
  cashExpLimit: string | null;
  cashExpCurrencyCode: string | null;
  subPurposeApp: boolean | null;
  unmapped: UnmappedPurposeField[];
};

export type CollapsedPurpose = {
  description: string;
  descriptionKey: string;
  code: string;
  codeSource: "initials" | "disambiguated";
  sell: boolean;
  purchase: boolean;
  corporate: boolean;
  individual: boolean;
  isActive: boolean;
  isDeleted: boolean;
  legacyPurposeCodes: string[];
  legacyIds: string[];
  unmapped: UnmappedPurposeField[];
};

const PURPOSE_STOP_WORDS = new Set([
  "A",
  "AN",
  "AND",
  "FOR",
  "IN",
  "OF",
  "THE",
  "TO",
  "WITH",
]);

const toNullableString = (value: any): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
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

export const normalizePurposeDescription = (value: string): string =>
  value
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

export const purposeDescriptionTokens = (description: string): string[] => {
  const raw = normalizePurposeDescription(description)
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  const withoutStops = raw.filter((token) => !PURPOSE_STOP_WORDS.has(token));
  return withoutStops.length > 0 ? withoutStops : raw;
};

/**
 * Always returns exactly 2 uppercase letters (A–Z), or null if description is empty.
 * Multi-token → first letters of first two significant tokens.
 * Single token → first two letters (pad with X if length 1).
 */
export const buildPurposeCodeFromDescription = (
  description: string,
): string | null => {
  const tokens = purposeDescriptionTokens(description);
  if (tokens.length === 0) {
    return null;
  }

  if (tokens.length >= 2) {
    const a = tokens[0][0];
    const b = tokens[1][0];
    if (a && b && /[A-Z]/i.test(a) && /[A-Z]/i.test(b)) {
      return `${a}${b}`.toUpperCase();
    }
  }

  const word = tokens[0].replace(/[^A-Z0-9]/gi, "").toUpperCase();
  if (!word) {
    return null;
  }
  if (word.length === 1) {
    return `${word}X`;
  }
  return word.slice(0, 2);
};

const letterCandidatesForDisambiguation = (
  description: string,
  preferred: string,
): string[] => {
  const tokens = purposeDescriptionTokens(description);
  const word = (tokens[0] ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const out: string[] = [];
  const push = (code: string | null) => {
    if (!code || code.length !== 2) return;
    const normalized = code.toUpperCase();
    if (!/^[A-Z]{2}$/.test(normalized)) return;
    if (!out.includes(normalized)) out.push(normalized);
  };

  push(preferred);
  if (word.length >= 2) {
    push(`${word[0]}${word[word.length - 1]}`);
    for (let i = 1; i < Math.min(word.length, 6); i += 1) {
      push(`${word[0]}${word[i]}`);
    }
  }
  if (tokens.length >= 3) {
    push(`${tokens[0][0]}${tokens[2][0]}`.toUpperCase());
  }
  for (let i = 0; i < 26; i += 1) {
    push(`${preferred[0]}${String.fromCharCode(65 + i)}`);
  }
  for (let i = 0; i < 26; i += 1) {
    for (let j = 0; j < 26; j += 1) {
      push(
        `${String.fromCharCode(65 + i)}${String.fromCharCode(65 + j)}`,
      );
    }
  }
  return out;
};

export const mapLegacyMstPurposeRow = (row: SourceRow): MappedMstPurposeRow => {
  const unmapped: UnmappedPurposeField[] = [];
  const descriptionRaw =
    toNullableString(row.Description ?? row.description) ?? "";
  const description = descriptionRaw.trim() || "UNKNOWN PURPOSE";
  const legacyPurposeCode = toNullableString(
    row.PurposeCode ?? row.purposeCode,
  );
  const statutoryCode = toNullableString(
    row.StatutoryCode ?? row.statutoryCode,
  );
  const cashExpLimit = toNullableString(row.CashExpLimit ?? row.cashExpLimit);
  const cashExpCurrencyCode = toNullableString(
    row.CashExpCurrencyCode ?? row.cashExpCurrencyCode,
  );
  const subPurposeAppRaw = row.SubPurposeApp ?? row.subPurposeApp;
  const subPurposeApp =
    subPurposeAppRaw === null || subPurposeAppRaw === undefined
      ? null
      : toBoolean(subPurposeAppRaw);

  const trnType = (toNullableString(row.vTrnType ?? row.VTrnType) ?? "")
    .trim()
    .toUpperCase();
  const trnSubType = (toNullableString(row.TrnSubType ?? row.trnSubType) ?? "")
    .trim()
    .toUpperCase();
  const trnWith = toNullableString(row.vTrnWith ?? row.VTrnWith);

  if (trnWith && trnWith.toUpperCase() !== "P") {
    unmapped.push({
      sourceColumn: "vTrnWith",
      sourceValue: trnWith,
      reason: "Unexpected vTrnWith (samples were always P); logged only",
    });
  }
  if (statutoryCode) {
    unmapped.push({
      sourceColumn: "StatutoryCode",
      sourceValue: statutoryCode,
      reason: "No StatutoryCode on purposes; logged unmapped",
    });
  }
  if (cashExpLimit && Number(cashExpLimit) !== 0) {
    unmapped.push({
      sourceColumn: "CashExpLimit",
      sourceValue: cashExpLimit,
      reason:
        "Cash expense limit not mapped (CQ-purpose-limits); not TCS threshold",
    });
  }
  if (cashExpCurrencyCode) {
    unmapped.push({
      sourceColumn: "CashExpCurrencyCode",
      sourceValue: cashExpCurrencyCode,
      reason: "No cash-exp currency on purposes; logged unmapped",
    });
  }
  if (subPurposeApp != null) {
    unmapped.push({
      sourceColumn: "SubPurposeApp",
      sourceValue: subPurposeApp,
      reason: "No SubPurposeApp flag on purposes; logged unmapped",
    });
  }
  if (legacyPurposeCode) {
    unmapped.push({
      sourceColumn: "PurposeCode",
      sourceValue: legacyPurposeCode,
      reason:
        "Old 1-char PurposeCode retained in notes/id-map only; new code is 2-letter initials from Description",
    });
  }

  const sell = trnType === "S";
  const purchase = trnType === "B";
  const corporate = trnSubType === "C";
  const individual = trnSubType === "I";

  if (!sell && !purchase) {
    unmapped.push({
      sourceColumn: "vTrnType",
      sourceValue: trnType || null,
      reason: "vTrnType not S/B; sell/purchase flags left false until collapsed",
    });
  }
  if (!corporate && !individual) {
    unmapped.push({
      sourceColumn: "TrnSubType",
      sourceValue: trnSubType || null,
      reason:
        "TrnSubType not C/I; corporate/individual flags left false until collapsed",
    });
  }

  return {
    oldId:
      row.nPurposeID != null && row.nPurposeID !== ""
        ? String(row.nPurposeID)
        : null,
    legacyPurposeCode,
    description,
    descriptionKey: normalizePurposeDescription(description),
    sell,
    purchase,
    corporate,
    individual,
    isActive: toBoolean(row.isActive ?? row.IsActive ?? 1),
    isDeleted: toBoolean(row.bIsDeleted ?? row.bIsdeleted),
    statutoryCode,
    cashExpLimit,
    cashExpCurrencyCode,
    subPurposeApp,
    unmapped,
  };
};

export const collapseMstPurposesByDescription = (
  rows: MappedMstPurposeRow[],
): CollapsedPurpose[] => {
  const byKey = new Map<string, MappedMstPurposeRow[]>();
  for (const row of rows) {
    const list = byKey.get(row.descriptionKey) ?? [];
    list.push(row);
    byKey.set(row.descriptionKey, list);
  }

  const preferredCodes = new Map<string, string>();
  const occupied = new Set<string>();
  const collapsed: CollapsedPurpose[] = [];

  for (const [descriptionKey, group] of byKey) {
    const description = group[0].description;
    let preferred = buildPurposeCodeFromDescription(description);
    if (!preferred) {
      preferred = "XX";
    }

    const candidates = letterCandidatesForDisambiguation(description, preferred);
    let code = candidates.find((candidate) => !occupied.has(candidate)) ?? null;
    let codeSource: "initials" | "disambiguated" = "initials";
    if (!code) {
      code = "ZZ";
      codeSource = "disambiguated";
    } else if (code !== preferred || preferredCodes.has(preferred)) {
      codeSource = code === preferred ? "initials" : "disambiguated";
    }
    if (code !== preferred) {
      codeSource = "disambiguated";
    }
    occupied.add(code);
    preferredCodes.set(preferred, code);

    const unmapped: UnmappedPurposeField[] = [];
    for (const row of group) {
      unmapped.push(...row.unmapped);
    }
    if (codeSource === "disambiguated") {
      unmapped.push({
        sourceColumn: "Description",
        sourceValue: description,
        reason: `Initials collision; assigned code ${code} (preferred ${preferred})`,
      });
    }

    let sell = false;
    let purchase = false;
    let corporate = false;
    let individual = false;
    let isActive = false;
    let isDeleted = true;
    const legacyPurposeCodes: string[] = [];
    const legacyIds: string[] = [];

    for (const row of group) {
      sell = sell || row.sell;
      purchase = purchase || row.purchase;
      corporate = corporate || row.corporate;
      individual = individual || row.individual;
      isActive = isActive || row.isActive;
      isDeleted = isDeleted && row.isDeleted;
      if (row.legacyPurposeCode && !legacyPurposeCodes.includes(row.legacyPurposeCode)) {
        legacyPurposeCodes.push(row.legacyPurposeCode);
      }
      if (row.oldId) {
        legacyIds.push(row.oldId);
      }
    }

    // Scope check requires at least one party flag and one direction flag.
    if (!sell && !purchase) {
      sell = true;
      unmapped.push({
        sourceColumn: "vTrnType",
        sourceValue: null,
        reason: "No S/B rows for this description; defaulted sell=true for scope check",
      });
    }
    if (!corporate && !individual) {
      individual = true;
      unmapped.push({
        sourceColumn: "TrnSubType",
        sourceValue: null,
        reason:
          "No C/I rows for this description; defaulted individual=true for scope check",
      });
    }

    collapsed.push({
      description,
      descriptionKey,
      code,
      codeSource,
      sell,
      purchase,
      corporate,
      individual,
      isActive,
      isDeleted,
      legacyPurposeCodes,
      legacyIds,
      unmapped,
    });
  }

  return collapsed.sort((a, b) => a.code.localeCompare(b.code));
};
