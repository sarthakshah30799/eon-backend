export type SourceRow = Record<string, any>;

export const LEGACY_TAX_TABLE_CANDIDATES = {
  mstTax: ["mstTax", "MstTax", "MSTTAX"],
  mstTaxd: ["mstTaxd", "MstTaxd", "MSTTAXD"],
  mstTaxExampt: ["mstTaxExampt", "MstTaxExampt", "MSTTAXEXAMPT"],
  tcsApplyFor: ["TCSApplyFor", "tcsapplyfor", "TCSAPPLYFOR"],
  tcsPerMaster: ["TCSPERMASTER", "tcspermaster", "TcsPerMaster"],
  tcsPanTrans: ["TCSPANTRANS", "tcspantrans", "TcsPanTrans"],
  tbTcsApi: ["tb_TCSAPI", "TB_TCSAPI", "tb_tcsapi"],
  gstInfo: ["GSTInfo", "gstinfo", "GSTINFO"],
  gstNoExempt: ["GSTNoExempt", "gstnoexempt", "GSTNOEXEMPT"],
  gstNoUpdate: ["GSTNOUPDATE", "gstnoupdate", "GSTNOUPDATE"],
  gstRcmSlab: ["gstrcmslab", "GSTRCMSLAB", "GstRcmSlab"],
  gstExempt: ["gstexepmpt", "gstexempt", "GSTEXEPMPT"],
} as const;

export const TAX_MIGRATION_SKIPPED_TABLES = [
  {
    table: "mstTax",
    reason:
      "Only CODE=gst18% is migrated to GST_RATE. HFEE/TAXROFF skipped for now (CQ-wave6) — no global fee/round-off tax-code master.",
    note: "Row-level: non-gst18% codes logged as skipped inside processMstTaxGstRate",
  },
  {
    table: "mstTaxd",
    reason:
      "GST amount-band slabs (18/9/1.8) — new app has single flat GST_RATE. CQ-wave6 skip.",
  },
  {
    table: "mstTaxExampt",
    reason:
      "Per-party/per-fee tax exemptions — no equivalent list; party applyTax boolean only. CQ-wave6 skip.",
  },
  {
    table: "TCSApplyFor",
    reason:
      "TCS apply gate (e.g. PS+IN) — no master target; sell TCS is purpose-driven. Log only.",
  },
  {
    table: "TCSPANTRANS",
    reason:
      "Per-bill TCS collection history — txn-later after sale headers exist.",
  },
  {
    table: "tb_TCSAPI",
    reason:
      "API token/secret — txn/env later; do not copy tokens as master data.",
  },
  {
    table: "GSTNoExempt",
    reason: "No GST-exempt master entity. CQ-wave6 skip.",
  },
  {
    table: "GSTNOUPDATE",
    reason: "Empty / no GSTIN-update master. Skip.",
  },
  {
    table: "gstrcmslab",
    reason: "No RCM master entity. CQ-wave6 skip.",
  },
  {
    table: "gstexepmpt",
    reason: "Table missing in sample DB / no exempt entity. CQ-wave6 skip.",
  },
] as const;

export type UnmappedTaxField = {
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

/** Old fraction (0.18) or already-percent (18) → display percent for GST_RATE. */
export const toGstRatePercent = (value: any): number | null => {
  const n = toNullableNumber(value);
  if (n === null) return null;
  if (n > 0 && n <= 1) {
    return Number((n * 100).toFixed(4));
  }
  return n;
};

export const isGst18TaxCode = (code: string | null): boolean => {
  if (!code) return false;
  const normalized = code.replace(/\s+/g, "").toLowerCase();
  return (
    normalized === "gst18%" ||
    normalized === "gst18" ||
    normalized.includes("gst18")
  );
};

export type MappedGstRateRow = {
  oldId: string | null;
  code: string | null;
  description: string | null;
  applyAs: string | null;
  rawValue: number | null;
  ratePercent: number | null;
  isGstRateCandidate: boolean;
  skipReason: string | null;
  unmapped: UnmappedTaxField[];
};

export const mapLegacyMstTaxRow = (row: SourceRow): MappedGstRateRow => {
  const unmapped: UnmappedTaxField[] = [];
  const code = toNullableString(row.CODE ?? row.Code ?? row.code);
  const description = toNullableString(
    row.DESCRIPTION ?? row.Description ?? row.description,
  );
  const applyAs = toNullableString(row.APPLYAS ?? row.ApplyAs ?? row.applyas);
  const rawValue = toNullableNumber(row.VALUE ?? row.Value ?? row.value);
  const isGstRateCandidate = isGst18TaxCode(code);
  const ratePercent = isGstRateCandidate ? toGstRatePercent(rawValue) : null;

  if (!isGstRateCandidate) {
    return {
      oldId:
        row.nTaxID != null && row.nTaxID !== "" ? String(row.nTaxID) : null,
      code,
      description,
      applyAs,
      rawValue,
      ratePercent: null,
      isGstRateCandidate: false,
      skipReason: `CODE ${code ?? "?"} is not gst18% — HFEE/TAXROFF/other skipped (CQ-wave6)`,
      unmapped,
    };
  }

  if (ratePercent === null) {
    return {
      oldId:
        row.nTaxID != null && row.nTaxID !== "" ? String(row.nTaxID) : null,
      code,
      description,
      applyAs,
      rawValue,
      ratePercent: null,
      isGstRateCandidate: true,
      skipReason: "gst18% row missing numeric VALUE",
      unmapped,
    };
  }

  if (applyAs && applyAs.toUpperCase() !== "%") {
    unmapped.push({
      sourceColumn: "APPLYAS",
      sourceValue: applyAs,
      reason: "Expected APPLYAS=% for GST rate; still using VALUE as percent",
    });
  }

  for (const col of [
    "RETAILBUY",
    "RETAILSELL",
    "BULKBUY",
    "BULKSELL",
    "nAccID",
    "SLABWISETAX",
  ] as const) {
    if (row[col] != null && row[col] !== "") {
      unmapped.push({
        sourceColumn: col,
        sourceValue: row[col],
        reason: "Not stored on GST_RATE additional setting",
      });
    }
  }

  return {
    oldId: row.nTaxID != null && row.nTaxID !== "" ? String(row.nTaxID) : null,
    code,
    description,
    applyAs,
    rawValue,
    ratePercent,
    isGstRateCandidate: true,
    skipReason: null,
    unmapped,
  };
};

export type MappedGstInfoRow = {
  oldId: string | null;
  legacyPartyId: string | null;
  partyCode: string | null;
  gstNo: string | null;
  igstNo: string | null;
  cgstNo: string | null;
  sgstNo: string | null;
  gstPickSource: "IGSTNO" | "CGSTNO" | "SGSTNO" | null;
  isActive: boolean;
  skipReason: string | null;
  unmapped: UnmappedTaxField[];
};

export const pickGstinFromGstInfo = (
  row: SourceRow,
): {
  gstNo: string | null;
  source: "IGSTNO" | "CGSTNO" | "SGSTNO" | null;
} => {
  const igst = toNullableString(row.IGSTNO ?? row.igstno ?? row.IgstNo);
  if (igst) return { gstNo: igst, source: "IGSTNO" };
  const cgst = toNullableString(row.CGSTNO ?? row.cgstno ?? row.CgstNo);
  if (cgst) return { gstNo: cgst, source: "CGSTNO" };
  const sgst = toNullableString(row.SGSTNO ?? row.sgstno ?? row.SgstNo);
  if (sgst) return { gstNo: sgst, source: "SGSTNO" };
  return { gstNo: null, source: null };
};

export const mapLegacyGstInfoRow = (row: SourceRow): MappedGstInfoRow => {
  const unmapped: UnmappedTaxField[] = [];
  const picked = pickGstinFromGstInfo(row);
  const igstNo = toNullableString(row.IGSTNO ?? row.igstno);
  const cgstNo = toNullableString(row.CGSTNO ?? row.cgstno);
  const sgstNo = toNullableString(row.SGSTNO ?? row.sgstno);
  const partyCode = toNullableString(row.vCode ?? row.VCode ?? row.code);
  const legacyPartyId =
    row.ncodesid != null && row.ncodesid !== "" && Number(row.ncodesid) !== 0
      ? String(row.ncodesid)
      : null;

  if (cgstNo && sgstNo && cgstNo !== sgstNo) {
    unmapped.push({
      sourceColumn: "CGSTNO/SGSTNO",
      sourceValue: `${cgstNo}|${sgstNo}`,
      reason:
        "CGSTNO and SGSTNO differ; prefer IGST then CGST then SGST per locked rule",
    });
  }
  if (picked.source === "CGSTNO" && sgstNo && sgstNo !== picked.gstNo) {
    unmapped.push({
      sourceColumn: "SGSTNO",
      sourceValue: sgstNo,
      reason: "SGSTNO not copied; CGSTNO preferred when IGST empty",
    });
  }

  let skipReason: string | null = null;
  if (!picked.gstNo) {
    skipReason = "No IGSTNO/CGSTNO/SGSTNO value";
  } else if (!legacyPartyId && !partyCode) {
    skipReason = "Missing ncodesid and vCode for party resolve";
  }

  return {
    oldId: row.Id != null && row.Id !== "" ? String(row.Id) : null,
    legacyPartyId,
    partyCode,
    gstNo: picked.gstNo,
    igstNo,
    cgstNo,
    sgstNo,
    gstPickSource: picked.source,
    isActive: toBoolean(row.Active ?? row.active ?? 1),
    skipReason,
    unmapped,
  };
};

export type MappedTcsPerMasterRow = {
  oldId: string | null;
  legacyPurposeCode: string | null;
  fromAmount: string | null;
  toAmount: string | null;
  ratePercent: string | null;
  partyType: string | null;
  fromDate: Date | null;
  toDate: Date | null;
  itrProcessed: boolean | null;
  tcsPerWithoutPan: string | null;
  skipReason: string | null;
  unmapped: UnmappedTaxField[];
};

const toNullableDate = (value: any): Date | null => {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const mapLegacyTcsPerMasterRow = (
  row: SourceRow,
): MappedTcsPerMasterRow => {
  const unmapped: UnmappedTaxField[] = [];
  const legacyPurposeCode = toNullableString(
    row.PURPOSECODE ?? row.PurposeCode ?? row.purposeCode,
  )?.toUpperCase() ?? null;
  const fromAmount = toNullableNumber(row.AMTFROM ?? row.AmtFrom);
  const toAmount = toNullableNumber(row.AMTTO ?? row.AmtTo);
  const rate = toNullableNumber(row.TCSPER ?? row.TcsPer);
  const partyType = toNullableString(row.PARTYTYPE ?? row.PartyType);
  const tcsPerWithoutPan = toNullableNumber(
    row.TCSPER_WOPAN ?? row.TcsPerWoPan,
  );
  const itrProcessed =
    row.bITRPRosses === null || row.bITRPRosses === undefined
      ? null
      : toBoolean(row.bITRPRosses);

  if (tcsPerWithoutPan != null) {
    unmapped.push({
      sourceColumn: "TCSPER_WOPAN",
      sourceValue: tcsPerWithoutPan,
      reason: "No without-PAN rate on purpose_slabs; txn-time only",
    });
  }
  if (itrProcessed != null) {
    unmapped.push({
      sourceColumn: "bITRPRosses",
      sourceValue: itrProcessed,
      reason: "ITR flag is txn-time (itrFiled), not a slab column",
    });
  }
  for (const col of ["TCSADDN", "TCSADDN_WOPAN"] as const) {
    if (row[col] != null && Number(row[col]) !== 0) {
      unmapped.push({
        sourceColumn: col,
        sourceValue: row[col],
        reason: "TCS add-on not on purpose_slabs",
      });
    }
  }

  let skipReason: string | null = null;
  if (!legacyPurposeCode) {
    skipReason = "Missing PURPOSECODE";
  } else if (fromAmount === null || rate === null) {
    skipReason = "Missing AMTFROM or TCSPER";
  }

  return {
    oldId:
      row.TCSAppID != null && row.TCSAppID !== ""
        ? String(row.TCSAppID)
        : null,
    legacyPurposeCode,
    fromAmount: fromAmount != null ? String(fromAmount) : null,
    toAmount: toAmount != null ? String(toAmount) : null,
    ratePercent: rate != null ? String(rate) : null,
    partyType,
    fromDate: toNullableDate(row.FROMDATE ?? row.FromDate),
    toDate: toNullableDate(row.TODATE ?? row.ToDate),
    itrProcessed,
    tcsPerWithoutPan:
      tcsPerWithoutPan != null ? String(tcsPerWithoutPan) : null,
    skipReason,
    unmapped,
  };
};

/**
 * Prefer the latest FROMDATE window; within a window keep one row per
 * (purposeCode, fromAmount, toAmount) preferring itrProcessed=true when duplicated.
 */
export const selectTcsPerMasterRowsForSlabs = (
  rows: MappedTcsPerMasterRow[],
): { selected: MappedTcsPerMasterRow[]; skipped: Array<{ row: MappedTcsPerMasterRow; reason: string }> } => {
  const skipped: Array<{ row: MappedTcsPerMasterRow; reason: string }> = [];
  const usable = rows.filter((row) => {
    if (row.skipReason) {
      skipped.push({ row, reason: row.skipReason });
      return false;
    }
    return true;
  });

  let latestFrom = 0;
  for (const row of usable) {
    const t = row.fromDate?.getTime() ?? 0;
    if (t > latestFrom) latestFrom = t;
  }

  const inWindow = usable.filter((row) => {
    const t = row.fromDate?.getTime() ?? 0;
    if (latestFrom > 0 && t < latestFrom) {
      skipped.push({
        row,
        reason: `Older FROMDATE window than latest (${row.fromDate?.toISOString() ?? "null"})`,
      });
      return false;
    }
    return true;
  });

  const byKey = new Map<string, MappedTcsPerMasterRow>();
  for (const row of inWindow) {
    const key = `${row.legacyPurposeCode}|${row.fromAmount}|${row.toAmount ?? ""}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      continue;
    }
    const preferNew =
      row.itrProcessed === true && existing.itrProcessed !== true;
    if (preferNew) {
      skipped.push({
        row: existing,
        reason: "Duplicate slab band; kept ITR-processed=true variant",
      });
      byKey.set(key, row);
    } else {
      skipped.push({
        row,
        reason: "Duplicate slab band for purpose+amount; already kept one",
      });
    }
  }

  return { selected: [...byKey.values()], skipped };
};
