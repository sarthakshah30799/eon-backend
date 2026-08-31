import { BadRequestException } from "@nestjs/common";
import { DataSource } from "typeorm";
import * as XLSX from "xlsx";
import { CardStockSettlementStatus } from "../card-stock/card-stock.enums";
import { toUtcDateOnly, toUtcNextDate } from "../common/date/date.util";
import {
  CardSettlementReportFormat,
  CardSettlementReportQueryDto,
} from "./dto/card-settlement-report-query.dto";
import { ReportSortBy } from "./dto/report-sort.dto";

export type CardSettlementReportKind = "unsettled" | "settled";

export type CardSettlementReportColumn = {
  key: string;
  label: string;
};

export type CardSettlementReportRow = Record<string, string> & {
  rowType: "GROUP" | "ITEM" | "SUBTOTAL";
  transactionId: string;
  partyProfileId: string;
  groupLabel?: string;
  sortBranch: string;
  sortDate: string;
};

type ResolvedFilters = {
  startDate: Date | null;
  endDateExclusive: Date | null;
  branchIds: string[];
  productIds: string[];
  currencyIds: string[];
  issuerPartyProfileIds: string[];
  sortBy: ReportSortBy;
};

type SettlementQueryRow = {
  id: string;
  branchId: string;
  saleDate: Date | string | null;
  denomination: string | null;
  buyRate: string | null;
  settlementAmount: string | null;
  branchSnapshot: Record<string, unknown> | string | null;
  hoBranchSnapshot: Record<string, unknown> | string | null;
  issuerPartyProfileSnapshot: Record<string, unknown> | string | null;
  productSnapshot: Record<string, unknown> | string | null;
  currencySnapshot: Record<string, unknown> | string | null;
  passengerSnapshot: Record<string, unknown> | string | null;
  maskedCardNumber: string | null;
  invoiceNumber: string | null;
  partyProfileSnapshot: Record<string, unknown> | string | null;
  rate: string | null;
  amount: string | null;
  profitAmount: string | null;
  branchDocumentDate: Date | string | null;
  branchDocumentNumber: string | null;
};

const MASKED_CARD_SQL = `CASE WHEN length(clear_number)<=8 THEN left(clear_number,4)||repeat('X',greatest(length(clear_number)-4,0)) ELSE left(clear_number,4)||repeat('X',length(clear_number)-8)||right(clear_number,4) END`;

const BRANCH_SETTLE_DATE_SQL = `COALESCE(bd.transaction_date, s.branch_settlement_date)`;

const UNSETTLED_COLUMNS: CardSettlementReportColumn[] = [
  { key: "date", label: "Date" },
  { key: "hoBranch", label: "HO Branch" },
  { key: "sellingBranch", label: "Selling Branch" },
  { key: "issuer", label: "Issuer" },
  { key: "product", label: "Product" },
  { key: "passengerName", label: "Passenger" },
  { key: "maskedCardNumber", label: "Card Number" },
  { key: "currency", label: "Currency" },
  { key: "quantity", label: "Quantity" },
  { key: "rate", label: "Rate" },
  { key: "amount", label: "Amount" },
];

const SETTLED_COLUMNS: CardSettlementReportColumn[] = [
  ...UNSETTLED_COLUMNS,
  { key: "invoiceNumber", label: "Invoice" },
  { key: "partyName", label: "Corporate / Individual" },
  { key: "settlementDate", label: "Settlement Date" },
  { key: "settlementNumber", label: "Settlement Number" },
  { key: "settlementRate", label: "Settlement Rate" },
  { key: "totalInr", label: "Total INR" },
  { key: "profitLoss", label: "Profit / Loss" },
];

const toText = (value: unknown) => {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim();
};

const parseSnapshot = (
  value: Record<string, unknown> | string | null | undefined,
): Record<string, unknown> | null => {
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
  return value;
};

const getSnapshotLabel = (
  snapshot: Record<string, unknown> | string | null | undefined,
) => {
  const parsed = parseSnapshot(snapshot);
  if (!parsed) {
    return "";
  }

  const code = toText(parsed.code);
  const name = toText(parsed.name);
  const label = toText(parsed.label);
  if (code && name) {
    return `${code} - ${name}`;
  }

  return label || name || code;
};

const getSnapshotCode = (
  snapshot: Record<string, unknown> | string | null | undefined,
) => {
  const parsed = parseSnapshot(snapshot);
  if (!parsed) {
    return "";
  }
  return toText(parsed.code);
};

const formatDateOnly = (value: Date | string | null | undefined) => {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
};

const formatStoredNumber = (
  value: number | string | null | undefined,
  scale: number,
) => {
  if (value === undefined || value === null || value === "") {
    return "";
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return "";
  }
  return parsed.toFixed(scale);
};

const toSortDate = (value: Date | string | null | undefined) => {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString();
};

const compareIsoDateStrings = (
  left: string,
  right: string,
  direction: ReportSortBy,
) => {
  if (left === right) {
    return 0;
  }
  const result = left.localeCompare(right);
  return direction === ReportSortBy.DATE_DESC ? result * -1 : result;
};

const emptyItemValues = (kind: CardSettlementReportKind) => {
  const values: Record<string, string> = {
    date: "",
    hoBranch: "",
    sellingBranch: "",
    issuer: "",
    product: "",
    passengerName: "",
    maskedCardNumber: "",
    currency: "",
    quantity: "",
    rate: "",
    amount: "",
  };

  if (kind === "settled") {
    values.invoiceNumber = "";
    values.partyName = "";
    values.settlementDate = "";
    values.settlementNumber = "";
    values.settlementRate = "";
    values.totalInr = "";
    values.profitLoss = "";
  }

  return values;
};

const sumStored = (rows: CardSettlementReportRow[], key: string) =>
  rows.reduce((total, row) => {
    const parsed = Number(row[key] ?? "");
    return Number.isFinite(parsed) ? total + parsed : total;
  }, 0);

export const getCardSettlementReportColumns = (
  kind: CardSettlementReportKind,
): CardSettlementReportColumn[] =>
  kind === "settled" ? SETTLED_COLUMNS : UNSETTLED_COLUMNS;

export const resolveCardSettlementReportFilters = (
  query: CardSettlementReportQueryDto,
): ResolvedFilters => {
  const hasStart = Boolean(query.startDate);
  const hasEnd = Boolean(query.endDate);

  if (hasStart !== hasEnd) {
    throw new BadRequestException("Both startDate and endDate are required");
  }

  const startDate = query.startDate ? toUtcDateOnly(query.startDate) : null;
  const endDateExclusive = query.endDate ? toUtcNextDate(query.endDate) : null;

  if (query.startDate && Number.isNaN(startDate?.getTime() ?? Number.NaN)) {
    throw new BadRequestException("Invalid startDate");
  }

  if (query.endDate && !endDateExclusive) {
    throw new BadRequestException("Invalid endDate");
  }

  return {
    startDate,
    endDateExclusive,
    branchIds: query.branchIds ?? [],
    productIds: query.productIds ?? [],
    currencyIds: query.currencyIds ?? [],
    issuerPartyProfileIds: query.issuerPartyProfileIds ?? [],
    sortBy: query.sortBy ?? ReportSortBy.DATE_ASC,
  };
};

const loadSettlementRows = async (
  database2: DataSource,
  kind: CardSettlementReportKind,
  filters: ResolvedFilters,
): Promise<SettlementQueryRow[]> => {
  const conditions = [
    "s.deleted_at IS NULL",
    "c.deleted_at IS NULL",
    "s.card_id IS NOT NULL",
    `s.status <> '${CardStockSettlementStatus.CANCELLED}'`,
  ];
  const params: unknown[] = [];

  if (kind === "unsettled") {
    if (filters.startDate) {
      params.push(filters.startDate);
      conditions.push(`s.sale_date >= $${params.length}`);
    }

    if (filters.endDateExclusive) {
      params.push(filters.endDateExclusive);
      conditions.push(`s.sale_date < $${params.length}`);
      conditions.push(
        `(s.branch_settlement_entry_id IS NULL OR ${BRANCH_SETTLE_DATE_SQL} >= $${params.length})`,
      );
    } else {
      conditions.push("s.branch_settlement_entry_id IS NULL");
    }
  } else {
    conditions.push("s.branch_settlement_entry_id IS NOT NULL");

    if (filters.startDate) {
      params.push(filters.startDate);
      conditions.push(`${BRANCH_SETTLE_DATE_SQL} >= $${params.length}`);
    }

    if (filters.endDateExclusive) {
      params.push(filters.endDateExclusive);
      conditions.push(`${BRANCH_SETTLE_DATE_SQL} < $${params.length}`);
    }
  }

  const addIn = (column: string, values: string[]) => {
    if (values.length === 0) {
      return;
    }
    const placeholders = values.map((value) => {
      params.push(value);
      return `$${params.length}`;
    });
    conditions.push(`${column} IN (${placeholders.join(", ")})`);
  };

  addIn("s.branch_id", filters.branchIds);
  addIn("s.product_id", filters.productIds);
  addIn("s.currency_id", filters.currencyIds);
  addIn("s.issuer_party_profile_id", filters.issuerPartyProfileIds);

  return database2.query(
    `SELECT
        s.id,
        s.branch_id AS "branchId",
        s.sale_date AS "saleDate",
        s.denomination,
        COALESCE(bal.settle_rate, s.buy_rate) AS "buyRate",
        COALESCE(bal.settle_amount, s.settlement_amount) AS "settlementAmount",
        s.branch_snapshot AS "branchSnapshot",
        s.ho_branch_snapshot AS "hoBranchSnapshot",
        s.issuer_party_profile_snapshot AS "issuerPartyProfileSnapshot",
        s.product_snapshot AS "productSnapshot",
        s.currency_snapshot AS "currencySnapshot",
        s.passenger_snapshot AS "passengerSnapshot",
        ${MASKED_CARD_SQL} AS "maskedCardNumber",
        t.number AS "invoiceNumber",
        t.party_profile_snapshot AS "partyProfileSnapshot",
        COALESCE(bal.sell_rate, ti.rate) AS "rate",
        COALESCE(bal.sell_amount, ti.amount) AS "amount",
        COALESCE(
          ti.profit_amount,
          ROUND(
            COALESCE(bal.sell_amount, ti.amount, 0)
              - COALESCE(bal.settle_amount, s.settlement_amount, 0),
            2
          )
        ) AS "profitAmount",
        ${BRANCH_SETTLE_DATE_SQL} AS "branchDocumentDate",
        bd.transaction_number AS "branchDocumentNumber"
      FROM card_stock_settlements s
      JOIN card_stock_cards c ON c.id = s.card_id
      CROSS JOIN LATERAL (
        SELECT public.decrypt_card_number(c.card_number) clear_number
      ) decoded
      LEFT JOIN LATERAL (
        SELECT balance.sell_rate, balance.sell_amount, balance.settle_rate, balance.settle_amount
        FROM card_stock_balance balance
        WHERE balance.card_id = s.card_id
          AND balance.branch_id = s.branch_id
          AND balance.series = s.series
          AND balance.deleted_at IS NULL
        ORDER BY balance.created_at DESC
        LIMIT 1
      ) bal ON TRUE
      LEFT JOIN transactions t ON t.id = s.transaction_id
      LEFT JOIN transaction_items ti ON ti.id = s.transaction_item_id
      LEFT JOIN card_stock_settlement_documents bd ON bd.id = s.branch_document_id
      WHERE ${conditions.join(" AND ")}`,
    params,
  );
};

const buildItemRow = (
  kind: CardSettlementReportKind,
  row: SettlementQueryRow,
): CardSettlementReportRow => {
  const branchLabel = getSnapshotLabel(row.branchSnapshot);
  const branchSortKey =
    getSnapshotCode(row.branchSnapshot) || branchLabel || row.branchId;
  const item: CardSettlementReportRow = {
    rowType: "ITEM",
    transactionId: row.id,
    partyProfileId: "",
    sortBranch: branchSortKey,
    sortDate: toSortDate(
      kind === "settled" ? row.branchDocumentDate : row.saleDate,
    ),
    date: formatDateOnly(row.saleDate),
    hoBranch: getSnapshotLabel(row.hoBranchSnapshot),
    sellingBranch: branchLabel,
    issuer: getSnapshotLabel(row.issuerPartyProfileSnapshot),
    product: getSnapshotLabel(row.productSnapshot),
    passengerName: getSnapshotLabel(row.passengerSnapshot),
    maskedCardNumber: toText(row.maskedCardNumber),
    currency: getSnapshotCode(row.currencySnapshot),
    quantity: formatStoredNumber(row.denomination, 2),
    rate: formatStoredNumber(row.rate, 7),
    amount: formatStoredNumber(row.amount, 2),
  };

  if (kind === "settled") {
    item.invoiceNumber = toText(row.invoiceNumber);
    item.partyName = getSnapshotLabel(row.partyProfileSnapshot);
    item.settlementDate = formatDateOnly(row.branchDocumentDate);
    item.settlementNumber = toText(row.branchDocumentNumber);
    item.settlementRate = formatStoredNumber(row.buyRate, 7);
    item.totalInr = formatStoredNumber(row.settlementAmount, 2);
    item.profitLoss = formatStoredNumber(row.profitAmount, 2);
  }

  return item;
};

const buildGroupRow = (
  kind: CardSettlementReportKind,
  item: CardSettlementReportRow,
): CardSettlementReportRow => ({
  rowType: "GROUP",
  transactionId: item.transactionId,
  partyProfileId: "",
  groupLabel: item.sellingBranch ? `Branch: ${item.sellingBranch}` : "Branch",
  sortBranch: item.sortBranch,
  sortDate: item.sortDate,
  ...emptyItemValues(kind),
  sellingBranch: item.sellingBranch,
});

const buildSubtotalRow = (
  kind: CardSettlementReportKind,
  items: CardSettlementReportRow[],
): CardSettlementReportRow => {
  const first = items[0];
  const row: CardSettlementReportRow = {
    rowType: "SUBTOTAL",
    transactionId: first?.transactionId ?? "",
    partyProfileId: "",
    sortBranch: first?.sortBranch ?? "",
    sortDate: first?.sortDate ?? "",
    ...emptyItemValues(kind),
    product: "Subtotal",
    quantity: formatStoredNumber(sumStored(items, "quantity"), 2),
    amount: formatStoredNumber(sumStored(items, "amount"), 2),
  };

  if (kind === "settled") {
    row.totalInr = formatStoredNumber(sumStored(items, "totalInr"), 2);
    row.profitLoss = formatStoredNumber(sumStored(items, "profitLoss"), 2);
  }

  return row;
};

const groupRows = (
  kind: CardSettlementReportKind,
  items: CardSettlementReportRow[],
  sortBy: ReportSortBy,
): CardSettlementReportRow[] => {
  const sorted = [...items].sort((left, right) => {
    if (left.sortBranch !== right.sortBranch) {
      return left.sortBranch.localeCompare(right.sortBranch);
    }
    if (left.sortDate !== right.sortDate) {
      return compareIsoDateStrings(left.sortDate, right.sortDate, sortBy);
    }
    return left.transactionId.localeCompare(right.transactionId);
  });

  const rows: CardSettlementReportRow[] = [];
  let currentItems: CardSettlementReportRow[] = [];
  let currentBranch = "";

  const flushGroup = () => {
    if (currentItems.length === 0) {
      return;
    }
    rows.push(buildGroupRow(kind, currentItems[0]));
    rows.push(...currentItems);
    rows.push(buildSubtotalRow(kind, currentItems));
    currentItems = [];
  };

  sorted.forEach((item) => {
    if (item.sortBranch !== currentBranch) {
      flushGroup();
      currentBranch = item.sortBranch;
    }
    currentItems.push(item);
  });
  flushGroup();

  return rows;
};

export const buildCardSettlementReport = async (
  database2: DataSource,
  kind: CardSettlementReportKind,
  query: CardSettlementReportQueryDto,
) => {
  const filters = resolveCardSettlementReportFilters(query);
  const sourceRows = await loadSettlementRows(database2, kind, filters);
  const itemRows = sourceRows.map((row) => buildItemRow(kind, row));

  return {
    columns: getCardSettlementReportColumns(kind),
    rows: groupRows(kind, itemRows, filters.sortBy),
    layout: "grouped" as const,
  };
};

export const buildCardSettlementReportExport = async (
  database2: DataSource,
  kind: CardSettlementReportKind,
  query: CardSettlementReportQueryDto,
  format: CardSettlementReportFormat,
) => {
  const report = await buildCardSettlementReport(database2, kind, query);
  const sheetData = report.rows.map((row) => {
    const output: Record<string, string> = {};
    report.columns.forEach((column) => {
      if (row.rowType === "GROUP" && column.key === "sellingBranch") {
        output[column.key] = row.groupLabel || row.sellingBranch || "";
        return;
      }
      output[column.key] = row[column.key] ?? "";
    });
    return output;
  });
  const filenamePrefix =
    kind === "settled" ? "card-settled-report" : "card-unsettled-report";

  if (format === CardSettlementReportFormat.CSV) {
    const worksheet = XLSX.utils.json_to_sheet(sheetData, {
      header: report.columns.map((column) => column.key),
    });
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    return {
      buffer: Buffer.from(csv, "utf8"),
      contentType: "text/csv; charset=utf-8",
      filename: `${filenamePrefix}.csv`,
    };
  }

  const worksheet = XLSX.utils.json_to_sheet(sheetData, {
    header: report.columns.map((column) => column.key),
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    kind === "settled" ? "SettledCARD" : "UnsettledCARD",
  );
  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;

  return {
    buffer,
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: `${filenamePrefix}.xlsx`,
  };
};
