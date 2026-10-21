import { DataSource } from "typeorm";
import * as XLSX from "xlsx";
import { toDisplayDateOnly, toUtcDateOnly } from "../common/date/date.util";
import { TransactionType } from "../transactions/transactions.enums";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import {
  AgeingBucket,
  AgeingEefcFilter,
  AgeingReportLayout,
  AgeingScope,
  type AgeingBucket as AgeingBucketId,
  type AgeingEefcFilter as EefcFilter,
  type AgeingReportLayout as ReportLayout,
  type AgeingScope as ReportScope,
} from "./dto/ageing-report-query.dto";
import {
  loadOutstandingSourceRows,
  loadSettlementsAfterAccountingDate,
  type OutstandingPartyMeta,
} from "./outstanding-transaction-report.helpers";

export type AgeingColumn = {
  key: string;
  label: string;
  rangeLabel: string;
};

export type AgeingRow = Record<string, string> & {
  lineKey: string;
  rowType: "BRANCH" | "PARTY" | "ITEM" | "BRANCH_TOTAL" | "GRAND_TOTAL";
};

export type AgeingReportResponse = {
  startDate: string;
  endDate: string;
  asOnDate: string;
  layout: ReportLayout;
  scope: ReportScope;
  message: string;
  columns: AgeingColumn[];
  rows: AgeingRow[];
};

type BucketDef = {
  key: AgeingBucketId;
  label: string;
  minDays: number;
  maxDays: number;
  newestOffset: number;
  oldestOffset: number;
  openEnded: boolean;
};

const BUCKETS: BucketDef[] = [
  {
    key: AgeingBucket.D1_10,
    label: "1 - 10 Days",
    minDays: 0,
    maxDays: 9,
    newestOffset: 0,
    oldestOffset: -9,
    openEnded: false,
  },
  {
    key: AgeingBucket.D11_20,
    label: "11 - 20 Days",
    minDays: 10,
    maxDays: 19,
    newestOffset: -10,
    oldestOffset: -19,
    openEnded: false,
  },
  {
    key: AgeingBucket.D21_30,
    label: "21 - 30 Days",
    minDays: 20,
    maxDays: 29,
    newestOffset: -20,
    oldestOffset: -29,
    openEnded: false,
  },
  {
    key: AgeingBucket.D31_45,
    label: "31 - 45 Days",
    minDays: 30,
    maxDays: 44,
    newestOffset: -30,
    oldestOffset: -44,
    openEnded: false,
  },
  {
    key: AgeingBucket.D46_90,
    label: "46 - 90 Days",
    minDays: 45,
    maxDays: 89,
    newestOffset: -45,
    oldestOffset: -89,
    openEnded: false,
  },
  {
    key: AgeingBucket.D91_180,
    label: "91 - 180 Days",
    minDays: 90,
    maxDays: 179,
    newestOffset: -90,
    oldestOffset: -179,
    openEnded: false,
  },
  {
    key: AgeingBucket.D181_365,
    label: "181 - 365 Days",
    minDays: 180,
    maxDays: 364,
    newestOffset: -180,
    oldestOffset: -364,
    openEnded: false,
  },
  {
    key: AgeingBucket.ABOVE_365,
    label: "Above 365 Days",
    minDays: 365,
    maxDays: Number.POSITIVE_INFINITY,
    newestOffset: -365,
    oldestOffset: -365,
    openEnded: true,
  },
];

const DETAIL_LEAD = [
  { key: "docNo", label: "Doc No" },
  { key: "code", label: "Code" },
  { key: "name", label: "Name" },
  { key: "broker", label: "Broker" },
  { key: "passport", label: "Passport" },
  { key: "totalOs", label: "Total O/S" },
];

const SUMMARY_LEAD = [
  { key: "branch", label: "Branch" },
  { key: "code", label: "Code" },
  { key: "name", label: "Name" },
  { key: "creditDays", label: "Credit Days" },
  { key: "creditLimit", label: "Credit Limit" },
];

const TAIL = [
  { key: "onAccount", label: "On Account" },
  { key: "category", label: "Category" },
];

type SourceRow = Awaited<ReturnType<typeof loadOutstandingSourceRows>>[number];

type PartyMeta = OutstandingPartyMeta & {
  creditDays: number;
  creditLimit: number;
};

type AgeingLine = {
  branchKey: string;
  branchLabel: string;
  partyKey: string;
  partyCode: string;
  partyName: string;
  creditDays: number;
  creditLimit: number;
  category: string;
  bucketKey: AgeingBucketId;
  outstanding: number;
  docNo: string;
  invoiceDate: string;
  broker: string;
  passport: string;
  sortNumber: string;
};

const money = (value: number) =>
  (Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2);

const toNumber = (value: string | number | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseSnapshot = (value: unknown): Record<string, unknown> | null => {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }
  if (typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return null;
};

const snapshotText = (
  snapshot: Record<string, unknown> | null,
  keys: string[],
) => {
  if (!snapshot) {
    return "";
  }
  for (const key of keys) {
    const value = snapshot[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number") {
      return String(value);
    }
  }
  return "";
};

const dateOnly = (value: Date | string | null | undefined) => {
  if (!value) {
    return "";
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toISOString().slice(0, 10);
};

const shiftIsoDate = (isoDate: string, dayOffset: number) => {
  const next = toUtcDateOnly(isoDate);
  next.setUTCDate(next.getUTCDate() + dayOffset);
  return next.toISOString().slice(0, 10);
};

const shortDate = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) {
    return isoDate;
  }
  return `${day}/${month}`;
};

const ageDays = (invoiceDate: string, asOnDate: string) => {
  const start = toUtcDateOnly(invoiceDate).getTime();
  const end = toUtcDateOnly(asOnDate).getTime();
  return Math.max(0, Math.round((end - start) / 86400000));
};

const bucketForAge = (days: number) =>
  BUCKETS.find((bucket) => days >= bucket.minDays && days <= bucket.maxDays) ??
  BUCKETS[BUCKETS.length - 1];

const bucketRangeLabel = (bucket: BucketDef, asOnDate: string) => {
  if (bucket.openEnded) {
    return `< ${shortDate(shiftIsoDate(asOnDate, bucket.oldestOffset + 1))}`;
  }
  return `${shortDate(shiftIsoDate(asOnDate, bucket.newestOffset))} - ${shortDate(shiftIsoDate(asOnDate, bucket.oldestOffset))}`;
};

const blank = (columns: AgeingColumn[]): Record<string, string> =>
  Object.fromEntries(columns.map((column) => [column.key, ""]));

export const loadAgeingPartyMeta = async (
  database: DataSource,
  partyIds: string[],
): Promise<Map<string, PartyMeta>> => {
  const uniqueIds = [...new Set(partyIds.filter(Boolean))];
  if (!uniqueIds.length) {
    return new Map();
  }
  const rows = (await database.query(
    `SELECT
        pp.id AS "id",
        pp.eefc_client AS "eefcClient",
        pp.credit_days AS "creditDays",
        pp.credit_limit AS "creditLimit",
        COALESCE(entity_type.code, '') AS "entityTypeCode"
      FROM party_profiles pp
      LEFT JOIN category_options entity_type
        ON entity_type.id = pp.entity_type_id
        AND entity_type.deleted_at IS NULL
      WHERE pp.id = ANY($1::uuid[])`,
    [uniqueIds],
  )) as Array<{
    id: string;
    eefcClient: boolean | null;
    creditDays: string | number | null;
    creditLimit: string | number | null;
    entityTypeCode: string | null;
  }>;
  return new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        eefcClient: row.eefcClient,
        entityTypeCode: row.entityTypeCode,
        creditDays: toNumber(row.creditDays),
        creditLimit: toNumber(row.creditLimit),
      },
    ]),
  );
};

export const filterAgeingTransactionIdsByAccount = async (
  database2: DataSource,
  transactionIds: string[],
  accountIds: string[],
) => {
  const uniqueIds = [...new Set(transactionIds.filter(Boolean))];
  if (!uniqueIds.length || !accountIds.length) {
    return new Set(uniqueIds);
  }
  const rows = (await database2.query(
    `SELECT DISTINCT posting.transaction_id AS "transactionId"
      FROM transaction_account_postings posting
      WHERE posting.deleted_at IS NULL
        AND posting.source_type::text = 'PARTY_CONTROL'
        AND posting.transaction_id = ANY($1::uuid[])
        AND posting.account_id = ANY($2::uuid[])`,
    [uniqueIds, accountIds],
  )) as Array<{ transactionId: string }>;
  return new Set(rows.map((row) => row.transactionId));
};

const buildColumns = (layout: ReportLayout, asOnDate: string): AgeingColumn[] => {
  const lead = layout === AgeingReportLayout.SUMMARY ? SUMMARY_LEAD : DETAIL_LEAD;
  const tail =
    layout === AgeingReportLayout.SUMMARY
      ? [
          { key: "onAccount", label: "On Account" },
          { key: "total", label: "Total" },
          { key: "category", label: "Category" },
        ]
      : TAIL;
  return [
    ...lead.map((column) => ({ ...column, rangeLabel: "" })),
    ...BUCKETS.map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      rangeLabel: bucketRangeLabel(bucket, asOnDate),
    })),
    ...tail.map((column) => ({ ...column, rangeLabel: "" })),
  ];
};

const emptyBuckets = (): Record<AgeingBucketId, number> =>
  Object.fromEntries(BUCKETS.map((bucket) => [bucket.key, 0])) as Record<
    AgeingBucketId,
    number
  >;

const bucketCells = (amounts: Record<AgeingBucketId, number>) =>
  Object.fromEntries(
    BUCKETS.map((bucket) => [bucket.key, money(amounts[bucket.key] ?? 0)]),
  );

const addLine = (
  amounts: Record<AgeingBucketId, number>,
  line: AgeingLine,
) => {
  amounts[line.bucketKey] += line.outstanding;
};

const sumLines = (lines: AgeingLine[]) => {
  const amounts = emptyBuckets();
  lines.forEach((line) => addLine(amounts, line));
  return amounts;
};

const matchesEefc = (meta: PartyMeta | undefined, filter: EefcFilter) => {
  if (filter === AgeingEefcFilter.ALL) {
    return true;
  }
  const isEefc = Boolean(meta?.eefcClient);
  return filter === AgeingEefcFilter.EEFC ? isEefc : !isEefc;
};

const toLines = (
  sourceRows: SourceRow[],
  options: {
    asOnDate: string;
    laterSettlementByTransactionId: ReadonlyMap<string, number>;
    partyMetaById: ReadonlyMap<string, PartyMeta>;
    allowedTransactionIds: ReadonlySet<string> | null;
    eefcFilter: EefcFilter;
    ageingBuckets: AgeingBucketId[];
  },
) => {
  const allowedBuckets = new Set(options.ageingBuckets);
  const lines: AgeingLine[] = [];
  sourceRows.forEach((source) => {
    if (
      options.allowedTransactionIds &&
      !options.allowedTransactionIds.has(source.id)
    ) {
      return;
    }
    const partyId = String(source.partyProfileId ?? "");
    const meta = options.partyMetaById.get(partyId);
    if (!matchesEefc(meta, options.eefcFilter)) {
      return;
    }
    const invoiceDate = dateOnly(source.transactionDate);
    if (!invoiceDate) {
      return;
    }
    const finalAmount = toNumber(source.finalAmount);
    const paidNow =
      toNumber(source.byCash) +
      toNumber(source.byCheque) +
      toNumber(source.byCard) +
      toNumber(source.byTransfer) +
      toNumber(source.byOther);
    const paidAfter = options.laterSettlementByTransactionId.get(source.id) ?? 0;
    const outstanding = Math.round((finalAmount - paidNow + paidAfter) * 100) / 100;
    if (outstanding <= 0) {
      return;
    }
    const bucket = bucketForAge(ageDays(invoiceDate, options.asOnDate));
    if (allowedBuckets.size && !allowedBuckets.has(bucket.key)) {
      return;
    }
    const branch = parseSnapshot(source.branchSnapshot);
    const party = parseSnapshot(source.partyProfileSnapshot);
    const agent = parseSnapshot(source.agentProfileSnapshot);
    const passenger = parseSnapshot(source.passengerSnapshot);
    const isSale = String(source.transactionType).toUpperCase() === TransactionType.SALE;
    const partyCode = snapshotText(party, ["code"]);
    const partyName = snapshotText(party, ["name"]);
    lines.push({
      branchKey: source.branchId || snapshotText(branch, ["code"]),
      branchLabel: snapshotText(branch, ["code"]) || source.branchId,
      partyKey: partyId || partyCode || partyName,
      partyCode,
      partyName,
      creditDays: meta?.creditDays ?? 0,
      creditLimit: meta?.creditLimit ?? 0,
      category: String(meta?.entityTypeCode ?? "").trim(),
      bucketKey: bucket.key,
      outstanding,
      docNo: `${isSale ? "PS" : "PP"}${String(source.number ?? "").trim()}`,
      invoiceDate,
      broker: snapshotText(agent, ["name", "code"]),
      passport: snapshotText(passenger, ["passportNumber"]),
      sortNumber: String(source.number ?? ""),
    });
  });
  return lines;
};

const partyHeaderCells = (
  columns: AgeingColumn[],
  line: AgeingLine,
  layout: ReportLayout,
) => {
  const cells = blank(columns);
  cells.code = line.partyCode;
  cells.name = line.partyName;
  cells.category = line.category;
  if (layout === AgeingReportLayout.DETAIL) {
    cells.broker = `Credit Days: ${money(line.creditDays)}`;
    cells.totalOs = `Credit Limit: ${money(line.creditLimit)}`;
    return cells;
  }
  cells.branch = line.branchLabel;
  cells.creditDays = money(line.creditDays);
  cells.creditLimit = money(line.creditLimit);
  return cells;
};

const amountCells = (
  columns: AgeingColumn[],
  lines: AgeingLine[],
  layout: ReportLayout,
) => {
  const amounts = sumLines(lines);
  const total = lines.reduce((sum, line) => sum + line.outstanding, 0);
  return {
    ...blank(columns),
    ...bucketCells(amounts),
    onAccount: money(0),
    ...(layout === AgeingReportLayout.DETAIL
      ? { totalOs: money(total) }
      : { total: money(total) }),
  };
};

const pushDetailItems = (
  rows: AgeingRow[],
  columns: AgeingColumn[],
  headerKey: string,
  lines: AgeingLine[],
) => {
  [...lines]
    .sort((left, right) =>
      left.invoiceDate === right.invoiceDate
        ? left.sortNumber.localeCompare(right.sortNumber)
        : left.invoiceDate.localeCompare(right.invoiceDate),
    )
    .forEach((line) => {
      const amounts = emptyBuckets();
      amounts[line.bucketKey] = line.outstanding;
      rows.push({
        ...blank(columns),
        ...bucketCells(amounts),
        lineKey: `${headerKey}:${line.docNo}`,
        rowType: "ITEM",
        docNo: line.docNo,
        code: toDisplayDateOnly(line.invoiceDate),
        broker: line.broker,
        passport: line.passport,
        totalOs: money(line.outstanding),
        onAccount: money(0),
        category: line.category,
      });
    });
};

const grouped = (lines: AgeingLine[], keyOf: (line: AgeingLine) => string) => {
  const groups = new Map<string, AgeingLine[]>();
  lines.forEach((line) => {
    const key = keyOf(line);
    const current = groups.get(key) ?? [];
    current.push(line);
    groups.set(key, current);
  });
  return [...groups.entries()].sort((left, right) =>
    (left[1][0]?.partyCode || left[1][0]?.branchLabel || "").localeCompare(
      right[1][0]?.partyCode || right[1][0]?.branchLabel || "",
    ),
  );
};

export const buildAgeingReport = (
  sourceRows: SourceRow[],
  options: {
    startDate: string;
    endDate: string;
    asOnDate: string;
    layout: ReportLayout;
    scope: ReportScope;
    eefcFilter: EefcFilter;
    ageingBuckets: AgeingBucketId[];
    laterSettlementByTransactionId: ReadonlyMap<string, number>;
    partyMetaById: ReadonlyMap<string, PartyMeta>;
    allowedTransactionIds: ReadonlySet<string> | null;
  },
): AgeingReportResponse => {
  const columns = buildColumns(options.layout, options.asOnDate);
  const lines = toLines(sourceRows, options);
  const rows: AgeingRow[] = [];
  const branchMode = options.scope === AgeingScope.BRANCH;
  const detail = options.layout === AgeingReportLayout.DETAIL;

  const pushParty = (partyLines: AgeingLine[], headerKey: string) => {
    const sample = partyLines[0];
    if (!sample) {
      return;
    }
    if (detail) {
      rows.push({
        ...partyHeaderCells(columns, sample, options.layout),
        lineKey: headerKey,
        rowType: "PARTY",
      });
      pushDetailItems(rows, columns, headerKey, partyLines);
      return;
    }
    rows.push({
      ...partyHeaderCells(columns, sample, options.layout),
      ...amountCells(columns, partyLines, options.layout),
      lineKey: headerKey,
      rowType: "PARTY",
      code: sample.partyCode,
      name: sample.partyName,
      category: sample.category,
      creditDays: money(sample.creditDays),
      creditLimit: money(sample.creditLimit),
      branch: branchMode ? sample.branchLabel : "",
    });
  };

  const pushBranchTotal = (branchKey: string, branchLines: AgeingLine[]) => {
    const labelCell = detail ? "docNo" : "branch";
    rows.push({
      ...amountCells(columns, branchLines, options.layout),
      lineKey: `branch-total:${branchKey}`,
      rowType: "BRANCH_TOTAL",
      [labelCell]: "Branch Total",
    });
  };

  if (!lines.length) {
    return {
      startDate: options.startDate,
      endDate: options.endDate,
      asOnDate: options.asOnDate,
      layout: options.layout,
      scope: options.scope,
      message: "No outstanding transactions",
      columns,
      rows,
    };
  }

  if (branchMode) {
    const branches = new Map<string, AgeingLine[]>();
    lines.forEach((line) => {
      const current = branches.get(line.branchKey) ?? [];
      current.push(line);
      branches.set(line.branchKey, current);
    });
    [...branches.entries()]
      .sort((left, right) =>
        (left[1][0]?.branchLabel ?? "").localeCompare(right[1][0]?.branchLabel ?? ""),
      )
      .forEach(([branchKey, branchLines]) => {
        if (detail) {
          rows.push({
            ...blank(columns),
            lineKey: `branch:${branchKey}`,
            rowType: "BRANCH",
            docNo: branchLines[0]?.branchLabel ?? "",
          });
        }
        grouped(branchLines, (line) => line.partyKey)
          .sort((left, right) =>
            (left[1][0]?.partyCode ?? "").localeCompare(right[1][0]?.partyCode ?? ""),
          )
          .forEach(([partyKey, partyLines]) => {
            pushParty(partyLines, `${branchKey}:${partyKey}`);
          });
        pushBranchTotal(branchKey, branchLines);
      });
  } else {
    grouped(lines, (line) => line.partyKey)
      .sort((left, right) =>
        (left[1][0]?.partyCode ?? "").localeCompare(right[1][0]?.partyCode ?? ""),
      )
      .forEach(([partyKey, partyLines]) => {
        pushParty(partyLines, partyKey);
      });
  }

  rows.push({
    ...amountCells(columns, lines, options.layout),
    lineKey: "grand-total",
    rowType: "GRAND_TOTAL",
    [detail ? "docNo" : "branch"]: "Grand Total",
  });

  return {
    startDate: options.startDate,
    endDate: options.endDate,
    asOnDate: options.asOnDate,
    layout: options.layout,
    scope: options.scope,
    message: "",
    columns,
    rows,
  };
};

export const buildAgeingExport = (
  report: AgeingReportResponse,
  format: CardSettlementReportFormat,
) => {
  const extension = format === CardSettlementReportFormat.CSV ? "csv" : "xlsx";
  const filename = `ageing-report-${report.startDate}-to-${report.endDate}.${extension}`;
  const header = report.columns.map((column) =>
    column.rangeLabel ? `${column.label} (${column.rangeLabel})` : column.label,
  );
  const body = report.rows.map((row) =>
    report.columns.map((column) => row[column.key] ?? ""),
  );
  if (format === CardSettlementReportFormat.CSV) {
    const escape = (value: string) =>
      /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    const csv =
      report.message && !report.rows.length
        ? report.message
        : [header.join(","), ...body.map((row) => row.map(escape).join(","))].join(
            "\n",
          );
    return {
      filename,
      contentType: "text/csv; charset=utf-8",
      buffer: Buffer.from(csv, "utf8"),
    };
  }
  const sheet = XLSX.utils.aoa_to_sheet(
    report.message && !report.rows.length ? [[report.message]] : [header, ...body],
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Ageing");
  return {
    filename,
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer,
  };
};
