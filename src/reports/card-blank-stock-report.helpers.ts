import { BadRequestException } from "@nestjs/common";
import { DataSource } from "typeorm";
import * as XLSX from "xlsx";
import {
  CardStockCardStatus,
  CardStockOperationType,
} from "../card-stock/card-stock.enums";
import { toUtcDateOnly, toUtcNextDate } from "../common/date/date.util";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import { CardBlankStockReportQueryDto } from "./dto/card-blank-stock-report-query.dto";
import { ReportSortBy } from "./dto/report-sort.dto";

export type CardBlankStockReportColumn = {
  key: string;
  label: string;
};

export type CardBlankStockReportRow = Record<string, string> & {
  rowType: "ITEM";
  transactionId: string;
  partyProfileId: string;
  sortDate: string;
  sortInvoice: string;
  sortCard: string;
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

type BlankStockQueryRow = {
  id: string;
  receiveDate: Date | string | null;
  invoiceNumber: string | null;
  branchSnapshot: Record<string, unknown> | string | null;
  issuerPartyProfileSnapshot: Record<string, unknown> | string | null;
  productSnapshot: Record<string, unknown> | string | null;
  currencySnapshot: Record<string, unknown> | string | null;
  maskedCardNumber: string | null;
};

const MASKED_CARD_SQL = `CASE WHEN length(clear_number)<=8 THEN left(clear_number,4)||repeat('X',greatest(length(clear_number)-4,0)) ELSE left(clear_number,4)||repeat('X',length(clear_number)-8)||right(clear_number,4) END`;

const COLUMNS: CardBlankStockReportColumn[] = [
  { key: "date", label: "Date" },
  { key: "invoiceNumber", label: "Invoice No" },
  { key: "branch", label: "Branch" },
  { key: "issuer", label: "Issuer Name" },
  { key: "exchangeType", label: "Exchange Type" },
  { key: "maskedCardNumber", label: "Card No" },
  { key: "currency", label: "Currency" },
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
  return (
    toText(parsed.code) ||
    toText(parsed.productCode) ||
    toText(parsed.currencyCode)
  );
};

const getSnapshotName = (
  snapshot: Record<string, unknown> | string | null | undefined,
) => {
  const parsed = parseSnapshot(snapshot);
  if (!parsed) {
    return "";
  }
  return toText(parsed.name) || toText(parsed.label) || toText(parsed.code);
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

export const resolveCardBlankStockReportFilters = (
  query: CardBlankStockReportQueryDto,
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

const loadBlankStockRows = async (
  database2: DataSource,
  filters: ResolvedFilters,
): Promise<BlankStockQueryRow[]> => {
  const conditions = [
    "b.deleted_at IS NULL",
    "c.deleted_at IS NULL",
    "stock.deleted_at IS NULL",
    "t.deleted_at IS NULL",
    "b.is_active = true",
    "b.sell_entry_id IS NULL",
    `c.status = '${CardStockCardStatus.AVAILABLE}'`,
    "c.reserved_by_transfer_id IS NULL",
    "c.reserved_at IS NULL",
    `stock.operation_type = '${CardStockOperationType.STOCK}'`,
  ];
  const params: unknown[] = [];

  if (filters.startDate) {
    params.push(filters.startDate);
    conditions.push(`stock.date >= $${params.length}`);
  }

  if (filters.endDateExclusive) {
    params.push(filters.endDateExclusive);
    conditions.push(`stock.date < $${params.length}`);
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

  addIn("b.branch_id", filters.branchIds);
  addIn("b.product_id", filters.productIds);
  addIn("b.currency_id", filters.currencyIds);
  addIn("b.issuer_party_profile_id", filters.issuerPartyProfileIds);

  return database2.query(
    `SELECT
        c.id,
        stock.date AS "receiveDate",
        t.number AS "invoiceNumber",
        b.branch_snapshot AS "branchSnapshot",
        b.issuer_party_profile_snapshot AS "issuerPartyProfileSnapshot",
        b.product_snapshot AS "productSnapshot",
        b.currency_snapshot AS "currencySnapshot",
        ${MASKED_CARD_SQL} AS "maskedCardNumber"
      FROM card_stock_balance b
      JOIN card_stock_cards c ON c.id = b.card_id
      JOIN card_stock_transaction_entries stock ON stock.card_id = b.card_id
      JOIN transactions t ON t.id = stock.transaction_id
      CROSS JOIN LATERAL (
        SELECT public.decrypt_card_number(c.card_number) clear_number
      ) decoded
      WHERE ${conditions.join(" AND ")}`,
    params,
  );
};

const buildItemRow = (row: BlankStockQueryRow): CardBlankStockReportRow => {
  const invoiceNumber = toText(row.invoiceNumber);
  const maskedCardNumber = toText(row.maskedCardNumber);

  return {
    rowType: "ITEM",
    transactionId: row.id,
    partyProfileId: "",
    sortDate: toSortDate(row.receiveDate),
    sortInvoice: invoiceNumber,
    sortCard: maskedCardNumber,
    date: formatDateOnly(row.receiveDate),
    invoiceNumber,
    branch: getSnapshotLabel(row.branchSnapshot),
    issuer: getSnapshotName(row.issuerPartyProfileSnapshot),
    exchangeType: getSnapshotCode(row.productSnapshot),
    maskedCardNumber,
    currency: getSnapshotCode(row.currencySnapshot),
  };
};

const sortRows = (
  items: CardBlankStockReportRow[],
  sortBy: ReportSortBy,
): CardBlankStockReportRow[] =>
  [...items].sort((left, right) => {
    const dateResult = compareIsoDateStrings(
      left.sortDate,
      right.sortDate,
      sortBy,
    );
    if (dateResult !== 0) {
      return dateResult;
    }
    if (left.sortInvoice !== right.sortInvoice) {
      return left.sortInvoice.localeCompare(right.sortInvoice);
    }
    return left.sortCard.localeCompare(right.sortCard);
  });

export const buildCardBlankStockReport = async (
  database2: DataSource,
  query: CardBlankStockReportQueryDto,
) => {
  const filters = resolveCardBlankStockReportFilters(query);
  const sourceRows = await loadBlankStockRows(database2, filters);
  const rows = sortRows(
    sourceRows.map((row) => buildItemRow(row)),
    filters.sortBy,
  );

  return {
    columns: COLUMNS,
    rows,
    layout: "flat" as const,
  };
};

export const buildCardBlankStockReportExport = async (
  database2: DataSource,
  query: CardBlankStockReportQueryDto,
  format: CardSettlementReportFormat,
) => {
  const report = await buildCardBlankStockReport(database2, query);
  const sheetData = report.rows.map((row) => {
    const output: Record<string, string> = {};
    report.columns.forEach((column) => {
      output[column.key] = row[column.key] ?? "";
    });
    return output;
  });

  if (format === CardSettlementReportFormat.CSV) {
    const worksheet = XLSX.utils.json_to_sheet(sheetData, {
      header: report.columns.map((column) => column.key),
    });
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    return {
      buffer: Buffer.from(csv, "utf8"),
      contentType: "text/csv; charset=utf-8",
      filename: "card-blank-stock-report.csv",
    };
  }

  const worksheet = XLSX.utils.json_to_sheet(sheetData, {
    header: report.columns.map((column) => column.key),
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "BlankStockCARD");
  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;

  return {
    buffer,
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: "card-blank-stock-report.xlsx",
  };
};
