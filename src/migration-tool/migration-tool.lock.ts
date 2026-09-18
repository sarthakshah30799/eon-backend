export type SourceRow = Record<string, any>;

export const LEGACY_LOCK_TABLE_CANDIDATES = {
  monthlock: ["monthlock", "MonthLock", "MONTHLOCK"],
  mLockBrnUserLink: [
    "MLockBrnUserLink",
    "mlockbrnuserlink",
    "MLOCKBRNUSERLINK",
  ],
} as const;

export type UnmappedLockField = {
  sourceColumn: string;
  sourceValue: string | number | boolean | null;
  reason: string;
};

export type MappedMonthLock = {
  oldId: number;
  branchCode: string | null;
  fromDate: string | null;
  toDate: string | null;
  isDeleted: boolean;
  openAccount: number | null;
  openTrading: number | null;
  cashTxn: number | null;
  unmapped: UnmappedLockField[];
  skipReason: string | null;
};

export type MappedMonthLockUserLink = {
  oldId: number | null;
  branchCode: string | null;
  branchOldId: number | null;
  userOldId: number | null;
  userName: string | null;
  isActive: boolean;
  isDeleted: boolean;
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

const toDateOnly = (value: any): string | null => {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = `${value.getMonth() + 1}`.padStart(2, "0");
    const d = `${value.getDate()}`.padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const text = String(value).trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  const y = parsed.getFullYear();
  const m = `${parsed.getMonth() + 1}`.padStart(2, "0");
  const d = `${parsed.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const mapLegacyMonthLockRow = (row: SourceRow): MappedMonthLock => {
  const oldId = toNullableNumber(row.nMonthLockID ?? row.NMonthLockID) ?? 0;
  const branchCode = toNullableString(row.vs_coname ?? row.VS_CONAME);
  const fromDate = toDateOnly(row.fromdate ?? row.FromDate ?? row.FROMDATE);
  const toDate = toDateOnly(row.todate ?? row.ToDate ?? row.TODATE);
  const openAccount = toNullableNumber(row.OPENACCOUNT ?? row.OpenAccount);
  const openTrading = toNullableNumber(row.OPENTRADING ?? row.OpenTrading);
  const cashTxn = toNullableNumber(row.CASHTXN ?? row.CashTxn);

  const unmapped: UnmappedLockField[] = [
    {
      sourceColumn: "OPENACCOUNT",
      sourceValue: openAccount,
      reason: "No OPENACCOUNT on monthly_lock_windows — CQ-wave7",
    },
    {
      sourceColumn: "OPENTRADING",
      sourceValue: openTrading,
      reason: "No OPENTRADING on monthly_lock_windows — CQ-wave7",
    },
    {
      sourceColumn: "CASHTXN",
      sourceValue: cashTxn,
      reason: "No CASHTXN on monthly_lock_windows — CQ-wave7",
    },
  ];

  let skipReason: string | null = null;
  if (!oldId) skipReason = "Missing nMonthLockID";
  else if (!branchCode) skipReason = "Missing vs_coname branch code";
  else if (!fromDate || !toDate) skipReason = "Missing fromdate/todate";

  return {
    oldId,
    branchCode,
    fromDate,
    toDate,
    isDeleted: toBooleanFlag(row.bIsDeleted ?? row.BIsDeleted),
    openAccount,
    openTrading,
    cashTxn,
    unmapped,
    skipReason,
  };
};

/** First lock per branch by lowest nMonthLockID (W7-2). */
export const pickFirstMonthLockPerBranch = (
  mapped: MappedMonthLock[],
): { selected: MappedMonthLock[]; skipped: MappedMonthLock[] } => {
  const byBranch = new Map<string, MappedMonthLock[]>();
  for (const row of mapped) {
    if (row.skipReason || !row.branchCode) continue;
    const key = row.branchCode.toUpperCase();
    const list = byBranch.get(key) ?? [];
    list.push(row);
    byBranch.set(key, list);
  }

  const selected: MappedMonthLock[] = [];
  const skipped: MappedMonthLock[] = [];
  for (const list of byBranch.values()) {
    const sorted = [...list].sort((a, b) => a.oldId - b.oldId);
    selected.push(sorted[0]);
    skipped.push(...sorted.slice(1));
  }
  return { selected, skipped };
};

export const mapLegacyMonthLockUserLink = (
  row: SourceRow,
): MappedMonthLockUserLink => {
  const oldId = toNullableNumber(
    row.nMLockBrnUserID ?? row.NMLockBrnUserID,
  );
  const branchCode = toNullableString(row.vBrnCode ?? row.VBrnCode);
  const branchOldId = toNullableNumber(row.nBrnID ?? row.NBrnID);
  const userOldId = toNullableNumber(row.nUID ?? row.NUID);
  const userName = toNullableString(row.vUName ?? row.VUName);

  let skipReason: string | null = null;
  if (!branchCode && branchOldId === null) {
    skipReason = "Missing branch on MLockBrnUserLink";
  } else if (userOldId === null) {
    skipReason = "Missing nUID";
  }

  return {
    oldId,
    branchCode,
    branchOldId,
    userOldId,
    userName,
    isActive: toBooleanFlag(row.isActive ?? row.IsActive),
    isDeleted: toBooleanFlag(row.bIsDeleted ?? row.BIsDeleted),
    skipReason,
  };
};
