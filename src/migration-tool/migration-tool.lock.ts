export type SourceRow = Record<string, any>;

export const LEGACY_LOCK_TABLE_CANDIDATES = {
  monthlock: ["monthlock", "MonthLock", "MONTHLOCK"],
  mLockBrnUserLink: [
    "MLockBrnUserLink",
    "mlockbrnuserlink",
    "MLOCKBRNUSERLINK",
  ],
  mlRecord: ["MLRECORD", "MLRecord", "mlrecord"],
} as const;

export type UnmappedLockField = {
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

const toDateOnlyString = (value: any): string | null => {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
};

export type MappedMonthLockRow = {
  oldId: string | null;
  branchCode: string | null;
  fromDate: string | null;
  toDate: string | null;
  isDeleted: boolean;
  skipReason: string | null;
  unmapped: UnmappedLockField[];
};

export const mapMonthLockRow = (row: SourceRow): MappedMonthLockRow => {
  const unmapped: UnmappedLockField[] = [];
  const oldId =
    row.nMonthLockID != null && row.nMonthLockID !== ""
      ? String(row.nMonthLockID)
      : null;
  const branchCode = toNullableString(
    row.vs_coname ?? row.VS_CONAME ?? row.branchCode,
  )?.toUpperCase() ?? null;
  const fromDate = toDateOnlyString(row.fromdate ?? row.FromDate ?? row.fromDate);
  const toDate = toDateOnlyString(row.todate ?? row.ToDate ?? row.toDate);
  const isDeleted = toBoolean(row.bIsDeleted ?? row.BIsDeleted);

  for (const col of ["OPENACCOUNT", "OPENTRADING", "CASHTXN"] as const) {
    const value = row[col];
    if (value != null && value !== "") {
      unmapped.push({
        sourceColumn: col,
        sourceValue: value,
        reason: "No new-app equivalent; CQ-wave7",
      });
    }
  }

  let skipReason: string | null = null;
  if (!branchCode) {
    skipReason = "Missing vs_coname branch code";
  } else if (!fromDate || !toDate) {
    skipReason = "Missing fromdate or todate";
  }

  return {
    oldId,
    branchCode,
    fromDate,
    toDate,
    isDeleted,
    skipReason,
    unmapped,
  };
};

/**
 * One lock window per branch — lowest nMonthLockID wins.
 * Soft-deleted rows are still candidates (kept as soft-deleted).
 * Link table has no nMonthLockID; join user links by branch to these dates.
 */
export const pickFirstMonthLockPerBranch = (
  rows: MappedMonthLockRow[],
): {
  selected: MappedMonthLockRow[];
  skipped: Array<{ row: MappedMonthLockRow; reason: string }>;
} => {
  const skipped: Array<{ row: MappedMonthLockRow; reason: string }> = [];
  const usable = rows.filter((row) => {
    if (row.skipReason) {
      skipped.push({ row, reason: row.skipReason });
      return false;
    }
    return true;
  });

  const sorted = [...usable].sort((a, b) => {
    const aId = Number(a.oldId ?? Number.POSITIVE_INFINITY);
    const bId = Number(b.oldId ?? Number.POSITIVE_INFINITY);
    return aId - bId;
  });

  const byBranch = new Map<string, MappedMonthLockRow>();
  for (const row of sorted) {
    const key = row.branchCode!;
    const existing = byBranch.get(key);
    if (!existing) {
      byBranch.set(key, row);
      continue;
    }
    skipped.push({
      row,
      reason: `Later monthlock for branch ${key}; kept lowest nMonthLockID ${existing.oldId}`,
    });
  }

  return { selected: [...byBranch.values()], skipped };
};

export type MappedMLockBrnUserLinkRow = {
  oldId: string | null;
  branchId: string | null;
  branchCode: string | null;
  userId: string | null;
  isActive: boolean;
  isDeleted: boolean;
  skipReason: string | null;
  unmapped: UnmappedLockField[];
  note: string;
};

/**
 * Branch/user eligibility for month lock.
 * No monthlock FK on source — join by branchCode to first lock dates only.
 */
export const mapMLockBrnUserLinkRow = (
  row: SourceRow,
): MappedMLockBrnUserLinkRow => {
  const unmapped: UnmappedLockField[] = [];
  const oldId =
    row.nMLockBrnUserID != null && row.nMLockBrnUserID !== ""
      ? String(row.nMLockBrnUserID)
      : null;
  const branchId =
    row.nBrnID != null && row.nBrnID !== "" ? String(row.nBrnID) : null;
  const branchCode = toNullableString(
    row.vBrnCode ?? row.VBrnCode,
  )?.toUpperCase() ?? null;
  const userId =
    row.nUID != null && row.nUID !== "" ? String(row.nUID) : null;
  const isActive = toBoolean(row.isActive ?? row.IsActive);
  const isDeleted = toBoolean(row.bIsDeleted ?? row.BIsDeleted);

  const userName = toNullableString(row.vUName ?? row.VUName);
  if (userName) {
    unmapped.push({
      sourceColumn: "vUName",
      sourceValue: userName,
      reason: "Display name only; resolve user by nUID",
    });
  }

  let skipReason: string | null = null;
  if (!branchCode && !branchId) {
    skipReason = "Missing vBrnCode and nBrnID";
  } else if (!userId) {
    skipReason = "Missing nUID";
  }

  return {
    oldId,
    branchId,
    branchCode,
    userId,
    isActive,
    isDeleted,
    skipReason,
    unmapped,
    note: "No monthlock FK — join by branch only to first lock dates",
  };
};
