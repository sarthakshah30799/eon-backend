import { BadRequestException } from "@nestjs/common";
import { DataSource } from "typeorm";
import * as XLSX from "xlsx";
import { toDisplayDateOnly, toUtcDateOnly, toUtcNextDate } from "../common/date/date.util";
import {
  TransactionStatus,
  TransactionType,
  TransactionTypeProfileEnum,
} from "../transactions/transactions.enums";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import {
  OutstandingGrouping,
  OutstandingPartySelection,
  OutstandingReportLayout,
  OutstandingTransactionSide,
  type OutstandingGrouping as ReportGrouping,
  type OutstandingPartySelection as PartySelection,
  type OutstandingReportLayout as ReportLayout,
  type OutstandingTransactionSide as TransactionSide,
} from "./dto/outstanding-transaction-report-query.dto";

export type OutstandingColumn = { key: string; label: string };
export type OutstandingRow = Record<string, string> & {
  lineKey: string;
  rowType: "BRANCH" | "PARTY" | "ITEM" | "TOTAL";
};

export type OutstandingReportResponse = {
  startDate: string;
  endDate: string;
  accountingDate: string;
  grouping: ReportGrouping;
  layout: ReportLayout;
  message: string;
  columns: OutstandingColumn[];
  rows: OutstandingRow[];
};

const COLUMNS: OutstandingColumn[] = [
  { key: "date", label: "Date" },
  { key: "type", label: "Type" },
  { key: "eefcSale", label: "EEFC Sale" },
  { key: "number", label: "No" },
  { key: "paxName", label: "Pax Name" },
  { key: "manualBillRef", label: "Manual Bill Ref" },
  { key: "agentName", label: "Agent Name" },
  { key: "inrAmount", label: "INR Amount" },
  { key: "toReceive", label: "To Receive" },
  { key: "toGive", label: "To Give" },
  { key: "days", label: "Days" },
  { key: "otherRef", label: "Other Ref." },
  { key: "uniqCode", label: "UniqCode." },
  { key: "reference", label: "Refrence." },
  { key: "category", label: "CATAGORY." },
];

const EXCLUDED_SLUGS = new Set(
  [
    TransactionTypeProfileEnum.FAKE_CURRENCY,
    TransactionTypeProfileEnum.CARD_STOCK_RECEIPT,
    TransactionTypeProfileEnum.CARD_TRANSFER_SELL,
    TransactionTypeProfileEnum.CARD_TRANSFER_PURCHASE,
    TransactionTypeProfileEnum.CARD_STOCK,
    TransactionTypeProfileEnum.CARD_TRANSFER_OUT,
    TransactionTypeProfileEnum.CARD_TRANSFER_IN,
    TransactionTypeProfileEnum.CARD_STOCK_LOAD,
    TransactionTypeProfileEnum.CARD_SELL,
    TransactionTypeProfileEnum.CARD_SETTLE,
    TransactionTypeProfileEnum.CM_SETTLE,
    TransactionTypeProfileEnum.TT_SETTLE,
    TransactionTypeProfileEnum.CARD_RETURN,
    TransactionTypeProfileEnum.CARD_VOID,
    "COUNTER_TRANSFER_SELL",
    "COUNTER_TRANSFER_PURCHASE",
    "BRANCH_TRANSFER_PURCHASE",
    "BRANCH_TRANSFER_SELL",
  ].map((slug) => slug.toUpperCase()),
);

type SourceRow = {
  id: string;
  number: string | null;
  transactionDate: Date | string;
  transactionType: string;
  branchId: string;
  partyProfileId: string | null;
  branchSnapshot: unknown;
  partyProfileSnapshot: unknown;
  agentProfileSnapshot: unknown;
  passengerSnapshot: unknown;
  manualBookPageSnapshot: unknown;
  finalAmount: string | number | null;
  byCash: string | number | null;
  byCheque: string | number | null;
  byCard: string | number | null;
  byTransfer: string | number | null;
  byOther: string | number | null;
};

export type OutstandingPartyMeta = {
  id: string;
  eefcClient: boolean | null;
  entityTypeCode: string | null;
};

type Line = {
  branchKey: string;
  branchLabel: string;
  partyKey: string;
  partyLabel: string;
  agentKey: string;
  agentLabel: string;
  cells: Record<string, string>;
  inrAmount: number;
  toReceive: number;
  toGive: number;
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

const dayCount = (invoiceDate: string, accountingDate: string) => {
  const start = toUtcDateOnly(invoiceDate).getTime();
  const end = toUtcDateOnly(accountingDate).getTime();
  return ((end - start) / 86400000).toFixed(2);
};

export const resolveOutstandingDateRange = (
  startDate: string,
  endDate: string,
  accountingDate: string,
) => {
  const start = toUtcDateOnly(startDate);
  const endExclusive = toUtcNextDate(endDate);
  const accounting = toUtcDateOnly(accountingDate);
  const accountingExclusive = toUtcNextDate(accountingDate);
  if (
    Number.isNaN(start.getTime()) ||
    !endExclusive ||
    Number.isNaN(accounting.getTime()) ||
    !accountingExclusive
  ) {
    throw new BadRequestException("Invalid date range");
  }
  if (start.getTime() >= endExclusive.getTime()) {
    throw new BadRequestException("Start date cannot be after end date");
  }
  return { startDate: start, endDateExclusive: endExclusive, accountingDate };
};

const msmeSql = `(
  COALESCE(entity_type.label, '') ILIKE '%MSME%'
  OR COALESCE(entity_type.value, '') ILIKE '%MSME%'
  OR COALESCE(entity_type.code, '') ILIKE '%MSME%'
)`;

export const loadOutstandingPartyIds = async (
  database: DataSource,
  filters: {
    partySelection: PartySelection;
    entityTypeId?: string;
    partyProfileIds?: string[];
  },
): Promise<string[] | null> => {
  const needsFilter =
    filters.partySelection !== OutstandingPartySelection.ALL ||
    Boolean(filters.entityTypeId) ||
    Boolean(filters.partyProfileIds?.length);
  if (!needsFilter) {
    return null;
  }

  const params: unknown[] = [];
  const conditions = ["pp.deleted_at IS NULL"];
  if (filters.partySelection === OutstandingPartySelection.MSME) {
    conditions.push(msmeSql);
  }
  if (filters.partySelection === OutstandingPartySelection.OTHERS) {
    conditions.push(`NOT ${msmeSql}`);
  }
  if (filters.entityTypeId) {
    params.push(filters.entityTypeId);
    conditions.push(`pp.entity_type_id = $${params.length}`);
  }
  if (filters.partyProfileIds?.length) {
    params.push(filters.partyProfileIds);
    conditions.push(`pp.id = ANY($${params.length}::uuid[])`);
  }

  const rows = (await database.query(
    `SELECT pp.id AS "id"
      FROM party_profiles pp
      LEFT JOIN category_options entity_type
        ON entity_type.id = pp.entity_type_id
        AND entity_type.deleted_at IS NULL
      WHERE ${conditions.join(" AND ")}`,
    params,
  )) as Array<{ id: string }>;
  return rows.map((row) => row.id);
};

export const loadOutstandingPartyMeta = async (
  database: DataSource,
  partyIds: string[],
): Promise<Map<string, OutstandingPartyMeta>> => {
  const uniqueIds = [...new Set(partyIds.filter(Boolean))];
  if (!uniqueIds.length) {
    return new Map();
  }
  const rows = (await database.query(
    `SELECT
        pp.id AS "id",
        pp.eefc_client AS "eefcClient",
        COALESCE(entity_type.code, '') AS "entityTypeCode"
      FROM party_profiles pp
      LEFT JOIN category_options entity_type
        ON entity_type.id = pp.entity_type_id
        AND entity_type.deleted_at IS NULL
      WHERE pp.id = ANY($1::uuid[])`,
    [uniqueIds],
  )) as OutstandingPartyMeta[];
  return new Map(rows.map((row) => [row.id, row]));
};

export const loadOutstandingSourceRows = async (
  database2: DataSource,
  filters: {
    startDate: Date;
    endDateExclusive: Date;
    accountingDate: string;
    branchIds: string[];
    partyProfileIds: string[] | null;
    transactionSide: TransactionSide;
  },
): Promise<SourceRow[]> => {
  if (filters.partyProfileIds && !filters.partyProfileIds.length) {
    return [];
  }
  const params: unknown[] = [
    filters.startDate,
    filters.endDateExclusive,
    filters.accountingDate,
  ];
  const excludedList = [...EXCLUDED_SLUGS]
    .map((slug) => `'${slug.replace(/'/g, "''")}'`)
    .join(", ");
  const conditions = [
    "tx.deleted_at IS NULL",
    "tx.is_latest = true",
    `tx.status = '${TransactionStatus.APPROVED}'`,
    "tx.party_profile_id IS NOT NULL",
    "tx.transaction_date >= $1",
    "tx.transaction_date < $2",
    "tx.transaction_date < ($3::date + INTERVAL '1 day')",
    "tx.slug IS NOT NULL",
    `UPPER(tx.slug) NOT IN (${excludedList})`,
  ];
  if (filters.transactionSide === OutstandingTransactionSide.SALE) {
    conditions.push(`tx.transaction_type = '${TransactionType.SALE}'`);
  } else if (filters.transactionSide === OutstandingTransactionSide.PURCHASE) {
    conditions.push(`tx.transaction_type = '${TransactionType.PURCHASE}'`);
  } else {
    conditions.push(
      `tx.transaction_type IN ('${TransactionType.SALE}', '${TransactionType.PURCHASE}')`,
    );
  }
  if (filters.branchIds.length) {
    params.push(filters.branchIds);
    conditions.push(`tx.branch_id = ANY($${params.length}::uuid[])`);
  }
  if (filters.partyProfileIds) {
    params.push(filters.partyProfileIds);
    conditions.push(`tx.party_profile_id = ANY($${params.length}::uuid[])`);
  }

  return database2.query(
    `SELECT
        tx.id AS "id",
        tx.number AS "number",
        tx.transaction_date AS "transactionDate",
        tx.transaction_type AS "transactionType",
        tx.branch_id AS "branchId",
        tx.party_profile_id AS "partyProfileId",
        tx.branch_snapshot AS "branchSnapshot",
        tx.party_profile_snapshot AS "partyProfileSnapshot",
        tx.agent_profile_snapshot AS "agentProfileSnapshot",
        tx.passenger_snapshot AS "passengerSnapshot",
        tx.manual_book_page_snapshot AS "manualBookPageSnapshot",
        tx.final_amount AS "finalAmount",
        tx.by_cash AS "byCash",
        tx.by_cheque AS "byCheque",
        tx.by_card AS "byCard",
        tx.by_transfer AS "byTransfer",
        tx.by_other AS "byOther"
      FROM transactions tx
      WHERE ${conditions.join(" AND ")}
      ORDER BY tx.transaction_date ASC, tx.number ASC`,
    params,
  );
};

export const loadSettlementsAfterAccountingDate = async (
  database2: DataSource,
  transactionIds: string[],
  accountingDate: string,
) => {
  const uniqueIds = [...new Set(transactionIds.filter(Boolean))];
  if (!uniqueIds.length) {
    return new Map<string, number>();
  }
  const rows = (await database2.query(
    `SELECT
        item.settled_transaction_id AS "transactionId",
        SUM(item.amount::numeric) AS "amount"
      FROM accounting_voucher_items item
      INNER JOIN accounting_vouchers voucher ON voucher.id = item.voucher_id
      WHERE item.deleted_at IS NULL
        AND voucher.deleted_at IS NULL
        AND item.settled_transaction_id = ANY($1::uuid[])
        AND voucher.transaction_date > $2::date
      GROUP BY item.settled_transaction_id`,
    [uniqueIds, accountingDate],
  )) as Array<{ transactionId: string; amount: string | number }>;
  return new Map(
    rows.map((row) => [row.transactionId, toNumber(row.amount)]),
  );
};

const blankCells = (): Record<string, string> =>
  Object.fromEntries(COLUMNS.map((column) => [column.key, ""]));

const totalCells = (lines: Line[]): Record<string, string> => {
  const inr = lines.reduce((sum, line) => sum + line.inrAmount, 0);
  const receive = lines.reduce((sum, line) => sum + line.toReceive, 0);
  const give = lines.reduce((sum, line) => sum + line.toGive, 0);
  return {
    ...blankCells(),
    inrAmount: money(inr),
    toReceive: money(receive),
    toGive: money(give),
  };
};

const pushGroup = (
  rows: OutstandingRow[],
  options: {
    headerType: "BRANCH" | "PARTY";
    headerKey: string;
    headerLabel: string;
    lines: Line[];
    includeItems: boolean;
  },
) => {
  rows.push({
    ...blankCells(),
    lineKey: options.headerKey,
    rowType: options.headerType,
    date: options.headerLabel,
  });
  if (options.includeItems) {
    options.lines.forEach((line) => {
      rows.push({
        ...line.cells,
        lineKey: `${options.headerKey}:${line.cells.number}:${line.cells.date}`,
        rowType: "ITEM",
      });
    });
  }
  rows.push({
    ...totalCells(options.lines),
    lineKey: `${options.headerKey}:total`,
    rowType: "TOTAL",
  });
};

export const buildOutstandingReport = (
  sourceRows: SourceRow[],
  options: {
    startDate: string;
    endDate: string;
    accountingDate: string;
    grouping: ReportGrouping;
    layout: ReportLayout;
    laterSettlementByTransactionId: ReadonlyMap<string, number>;
    partyMetaById: ReadonlyMap<string, OutstandingPartyMeta>;
  },
): OutstandingReportResponse => {
  const lines: Line[] = [];
  sourceRows.forEach((source) => {
    const invoiceDate = dateOnly(source.transactionDate);
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
    const branch = parseSnapshot(source.branchSnapshot);
    const party = parseSnapshot(source.partyProfileSnapshot);
    const agent = parseSnapshot(source.agentProfileSnapshot);
    const passenger = parseSnapshot(source.passengerSnapshot);
    const manual = parseSnapshot(source.manualBookPageSnapshot);
    const branchCode = snapshotText(branch, ["code"]) || source.branchId;
    const branchName = snapshotText(branch, ["name"]);
    const partyCode = snapshotText(party, ["code"]);
    const partyName = snapshotText(party, ["name"]);
    const partyId = String(source.partyProfileId ?? "");
    const meta = options.partyMetaById.get(partyId);
    const isSale = String(source.transactionType).toUpperCase() === TransactionType.SALE;
    const reference = [branchCode, source.number].filter(Boolean).join("-");
    const agentName = snapshotText(agent, ["name"]);
    lines.push({
      branchKey: source.branchId || branchCode,
      branchLabel: branchName || branchCode,
      partyKey: partyId || partyCode || partyName,
      partyLabel: [partyCode, partyName].filter(Boolean).join("-"),
      agentKey: snapshotText(agent, ["id", "code"]) || agentName || "no-agent",
      agentLabel: agentName || "No agent",
      inrAmount: finalAmount,
      toReceive: isSale ? outstanding : 0,
      toGive: isSale ? 0 : outstanding,
      cells: {
        date: toDisplayDateOnly(invoiceDate),
        type: isSale ? "PS" : "PP",
        eefcSale: meta?.eefcClient ? "Yes" : "",
        number: String(source.number ?? "").trim(),
        paxName:
          snapshotText(passenger, ["passportPassengerName"]) ||
          snapshotText(passenger, ["panHolderName"]),
        manualBillRef: snapshotText(manual, ["pageNo", "code", "number"]),
        agentName,
        inrAmount: money(finalAmount),
        toReceive: money(isSale ? outstanding : 0),
        toGive: money(isSale ? 0 : outstanding),
        days: dayCount(invoiceDate, options.accountingDate),
        otherRef: reference,
        uniqCode: "",
        reference,
        category: String(meta?.entityTypeCode ?? "").trim(),
      },
    });
  });

  const rows: OutstandingRow[] = [];
  const includeItems = options.layout !== OutstandingReportLayout.SUMMARY;
  const childKey = (line: Line) =>
    options.grouping === OutstandingGrouping.AGENT ? line.agentKey : line.partyKey;
  const childLabel = (groupLines: Line[]) =>
    options.grouping === OutstandingGrouping.AGENT
      ? groupLines[0]?.agentLabel ?? ""
      : groupLines[0]?.partyLabel ?? "";
  const branches = new Map<string, Map<string, Line[]>>();
  lines.forEach((line) => {
    const children = branches.get(line.branchKey) ?? new Map<string, Line[]>();
    const key = childKey(line);
    const current = children.get(key) ?? [];
    current.push(line);
    children.set(key, current);
    branches.set(line.branchKey, children);
  });
  [...branches.entries()]
    .sort((left, right) =>
      (left[1].values().next().value?.[0]?.branchLabel ?? "").localeCompare(
        right[1].values().next().value?.[0]?.branchLabel ?? "",
      ),
    )
    .forEach(([branchKey, children]) => {
      const branchLabel = children.values().next().value?.[0]?.branchLabel ?? "";
      rows.push({
        ...blankCells(),
        lineKey: `branch:${branchKey}`,
        rowType: "BRANCH",
        date: branchLabel,
      });
      [...children.entries()]
        .sort((left, right) => childLabel(left[1]).localeCompare(childLabel(right[1])))
        .forEach(([groupKey, groupLines]) => {
          if (includeItems) {
            pushGroup(rows, {
              headerType: "PARTY",
              headerKey: `${branchKey}:${groupKey}`,
              headerLabel: childLabel(groupLines),
              lines: groupLines,
              includeItems: true,
            });
            return;
          }
          rows.push({
            ...totalCells(groupLines),
            lineKey: `${branchKey}:${groupKey}`,
            rowType: "PARTY",
            date: childLabel(groupLines),
          });
        });
    });

  return {
    startDate: options.startDate,
    endDate: options.endDate,
    accountingDate: options.accountingDate,
    grouping: options.grouping,
    layout: options.layout,
    message: rows.length ? "" : "No outstanding transactions",
    columns: COLUMNS,
    rows,
  };
};

export const buildOutstandingExport = (
  report: OutstandingReportResponse,
  format: CardSettlementReportFormat,
) => {
  const extension = format === CardSettlementReportFormat.CSV ? "csv" : "xlsx";
  const filename = `outstanding-transaction-report-${report.startDate}-to-${report.endDate}.${extension}`;
  const header = report.columns.map((column) => column.label);
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
  XLSX.utils.book_append_sheet(workbook, sheet, "Outstanding");
  return {
    filename,
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer,
  };
};
