import { BadRequestException } from "@nestjs/common";
import { DataSource } from "typeorm";
import * as XLSX from "xlsx";
import { toUtcDateOnly, toUtcNextDate } from "../common/date/date.util";
import { PassengerOtherIdProofType } from "../passengers/passenger.entity";
import {
  TransactionPaymentMethod,
  TransactionStatus,
  TransactionTypeProfileEnum,
} from "../transactions/transactions.enums";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import {
  Flm3PurchaseFromPublicView,
  type Flm3PurchaseFromPublicView as Flm3View,
} from "./dto/flm3-purchase-from-public-query.dto";
import { FLM1_DEFAULT_PRODUCT_CODE } from "./flm1-report.constants";

export type Flm3ReportColumn = {
  key: string;
  label: string;
};

export type Flm3ReportRow = Record<string, string> & {
  rowType: "ITEM" | "TOTAL";
  transactionId: string;
};

export type Flm3ReportTotals = {
  feAmount: string;
  rupeeEquivalent: string;
  netAmount: string;
  commissionAmount: string;
  byCash: string;
  byCheque: string;
  byOther: string;
};

export type Flm3ReportResponse = {
  view: Flm3View;
  columns: Flm3ReportColumn[];
  rows: Flm3ReportRow[];
  totals: Flm3ReportTotals;
};

export type Flm3ItemRow = {
  transactionId: string;
  transactionDate: string | Date;
  transactionNumber: string | null;
  passengerSnapshot: Record<string, unknown> | string | null;
  loanAmount: string | number | null;
  lineNo: number | string;
  quantity: string | number | null;
  rate: string | number | null;
  per: string | number | null;
  amount: string | number | null;
  commission: string | number | null;
  currencySnapshot: Record<string, unknown> | string | null;
  productSnapshot: Record<string, unknown> | string | null;
};

export type Flm3PaymentRow = {
  transactionId: string;
  paymentMethod: string | null;
  amount: string | number | null;
};

export type Flm3OtherDocumentRow = {
  transactionId: string;
  documentType: string | null;
  documentNumber: string | null;
  lineNo: number | string;
};

type PaymentBuckets = {
  byCash: number;
  byCheque: number;
  byOther: number;
};

const OTHER_DOCUMENT_LABELS: Record<string, string> = {
  [PassengerOtherIdProofType.AADHAAR]: "AADHAAR",
  [PassengerOtherIdProofType.DRIVING_LICENSE]: "DRIVING LICENSE",
  [PassengerOtherIdProofType.PAN]: "PAN",
  [PassengerOtherIdProofType.VOTER_ID]: "VOTER ID",
};

const BASE_COLUMNS: Flm3ReportColumn[] = [
  { key: "date", label: "Date" },
  { key: "srNo", label: "Sr no" },
  { key: "customerName", label: "Name of customer" },
  { key: "nationality", label: "Nationality" },
  { key: "fullAddress", label: "Full Address" },
  {
    key: "identificationDocument",
    label: "Details of Identification documents",
  },
  { key: "currency", label: "Currency" },
  { key: "feAmount", label: "FE Amount" },
  { key: "rate", label: "Rate" },
  { key: "rupeeEquivalent", label: "Rupee equivalent" },
  { key: "transactionNo", label: "Transaction no" },
  { key: "transactionDate", label: "Transaction date" },
  { key: "product", label: "Product" },
];

const PAN_COLUMNS: Flm3ReportColumn[] = [
  { key: "passengerPan", label: "Passenger PAN" },
  { key: "remitterPan", label: "Remitter PAN" },
];

const COMMISSION_COLUMN: Flm3ReportColumn = {
  key: "commissionAmount",
  label: "Commission Amount",
};

export type Flm3BuildOptions = {
  includePanColumns?: boolean;
};

const buildColumns = (
  view: Flm3View,
  includePanColumns: boolean,
): Flm3ReportColumn[] => {
  const identificationIndex = BASE_COLUMNS.findIndex(
    (column) => column.key === "identificationDocument",
  );
  const withPan = includePanColumns
    ? [
        ...BASE_COLUMNS.slice(0, identificationIndex + 1),
        ...PAN_COLUMNS,
        ...BASE_COLUMNS.slice(identificationIndex + 1),
      ]
    : BASE_COLUMNS;

  if (view === Flm3PurchaseFromPublicView.EXTENDED) {
    return [
      ...withPan,
      { key: "netAmount", label: "Net Amount" },
      COMMISSION_COLUMN,
      { key: "byCash", label: "byCash" },
      { key: "byCheque", label: "byCheque" },
      { key: "byOther", label: "byOther" },
    ];
  }

  return [...withPan, COMMISSION_COLUMN];
};

const toNumber = (value: string | number | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatAmount = (value: number) => value.toFixed(2);

const formatQuantity = (value: number) => {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(7).replace(/\.?0+$/, "");
};

const formatRateLabel = (rate: number, per: number) => {
  const rateLabel = Number.isInteger(rate)
    ? String(rate)
    : rate.toFixed(7).replace(/\.?0+$/, "");
  if (Number.isFinite(per) && per > 0 && per !== 1) {
    const perLabel = Number.isInteger(per) ? String(per) : String(per);
    return `${rateLabel} (${perLabel})`;
  }
  return rateLabel;
};

const formatDisplayDate = (value: string | Date | null | undefined) => {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    const isoPrefix = value.trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoPrefix)) {
      const [year, month, day] = isoPrefix.split("-");
      return `${day}/${month}/${year}`;
    }
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const year = parsed.getUTCFullYear();
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  return `${day}/${month}/${year}`;
};

const parseSnapshot = (
  value: Record<string, unknown> | string | null | undefined,
): Record<string, unknown> => {
  if (!value) {
    return {};
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return value;
};

const snapshotText = (value: unknown): string => {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return snapshotText(
      record.name ?? record.code ?? record.label ?? record.value ?? "",
    );
  }
  return "";
};

const snapshotCode = (snapshot: Record<string, unknown>) =>
  snapshotText(snapshot.code ?? snapshot.productCode ?? snapshot.currencyCode);

const buildFullAddress = (snapshot: Record<string, unknown>) =>
  [
    snapshotText(snapshot.address1),
    snapshotText(snapshot.address2),
    snapshotText(snapshot.city),
    snapshotText(snapshot.state),
    snapshotText(snapshot.country),
  ]
    .filter(Boolean)
    .join(", ");

const buildIdentificationDocument = (
  snapshot: Record<string, unknown>,
  otherDocuments: Flm3OtherDocumentRow[],
) => {
  const passportNumber = snapshotText(snapshot.passportNumber);
  if (passportNumber) {
    return `PASSPORT ${passportNumber}`;
  }

  const panNumber = snapshotText(snapshot.panNumber);
  if (panNumber) {
    return `PAN ${panNumber}`;
  }

  const firstOther = [...otherDocuments].sort(
    (left, right) => toNumber(left.lineNo) - toNumber(right.lineNo),
  )[0];
  if (!firstOther?.documentNumber) {
    return "";
  }

  const typeKey = String(firstOther.documentType ?? "").toUpperCase();
  const typeLabel = OTHER_DOCUMENT_LABELS[typeKey] ?? typeKey;
  return `${typeLabel} ${String(firstOther.documentNumber).trim()}`.trim();
};

const buildPaymentBuckets = (
  payments: Flm3PaymentRow[],
  loanAmount: number,
): PaymentBuckets => {
  return payments.reduce<PaymentBuckets>(
    (totals, payment) => {
      const amount = toNumber(payment.amount);
      const method = String(payment.paymentMethod ?? "").toUpperCase();
      if (method === TransactionPaymentMethod.CASH) {
        totals.byCash += amount;
      } else if (method === TransactionPaymentMethod.CHEQUE) {
        totals.byCheque += amount;
      } else {
        totals.byOther += amount;
      }
      return totals;
    },
    {
      byCash: 0,
      byCheque: loanAmount,
      byOther: 0,
    },
  );
};

const resolveView = (view?: string): Flm3View =>
  view === Flm3PurchaseFromPublicView.EXTENDED
    ? Flm3PurchaseFromPublicView.EXTENDED
    : Flm3PurchaseFromPublicView.NORMAL;

export const resolveFlm3DateRange = (startDate?: string, endDate?: string) => {
  const resolvedStart = startDate || new Date().toISOString().slice(0, 10);
  const resolvedEnd = endDate || resolvedStart;
  const start = toUtcDateOnly(resolvedStart);
  const endExclusive = toUtcNextDate(resolvedEnd);
  if (Number.isNaN(start.getTime()) || !endExclusive) {
    throw new BadRequestException("Invalid date range");
  }
  if (start.getTime() >= endExclusive.getTime()) {
    throw new BadRequestException("Start date cannot be after end date");
  }
  return { startDate: start, endDateExclusive: endExclusive };
};

export const loadFlmRegisterItemRows = async (
  database2: DataSource,
  filters: {
    startDate: Date;
    endDateExclusive: Date;
    branchIds: string[];
    productId?: string;
  },
  slugs: string[],
): Promise<Flm3ItemRow[]> => {
  const params: unknown[] = [filters.startDate, filters.endDateExclusive];
  const slugList = slugs.map((slug) => `'${slug}'`).join(", ");
  const conditions = [
    "tx.deleted_at IS NULL",
    "item.deleted_at IS NULL",
    "tx.is_latest = true",
    `tx.status = '${TransactionStatus.APPROVED}'`,
    `UPPER(tx.slug) IN (${slugList})`,
    "tx.transaction_date >= $1",
    "tx.transaction_date < $2",
  ];

  if (filters.productId) {
    params.push(filters.productId);
    conditions.push(`item.product_id = $${params.length}`);
  } else {
    conditions.push(
      `UPPER(COALESCE(item.product_snapshot->>'code', item.product_snapshot->>'productCode', '')) = '${FLM1_DEFAULT_PRODUCT_CODE}'`,
    );
  }

  if (filters.branchIds.length) {
    const placeholders = filters.branchIds.map((branchId) => {
      params.push(branchId);
      return `$${params.length}`;
    });
    conditions.push(`tx.branch_id IN (${placeholders.join(", ")})`);
  }

  return database2.query(
    `SELECT
        tx.id AS "transactionId",
        tx.transaction_date AS "transactionDate",
        tx.number AS "transactionNumber",
        tx.passenger_snapshot AS "passengerSnapshot",
        tx.loan_amount AS "loanAmount",
        item.line_no AS "lineNo",
        item.quantity AS "quantity",
        item.rate AS "rate",
        item.per AS "per",
        item.amount AS "amount",
        item.commission AS "commission",
        item.currency_snapshot AS "currencySnapshot",
        item.product_snapshot AS "productSnapshot"
      FROM transaction_items item
      INNER JOIN transactions tx ON tx.id = item.transaction_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY tx.transaction_date ASC, tx.number ASC, item.line_no ASC`,
    params,
  );
};

export const loadFlm3ItemRows = (
  database2: DataSource,
  filters: {
    startDate: Date;
    endDateExclusive: Date;
    branchIds: string[];
    productId?: string;
  },
) =>
  loadFlmRegisterItemRows(database2, filters, [
    TransactionTypeProfileEnum.PURCHASE_CORPORATE_INDIVIDUAL,
  ]);

export const loadFlm3PaymentRows = async (
  database2: DataSource,
  transactionIds: string[],
): Promise<Flm3PaymentRow[]> => {
  if (!transactionIds.length) {
    return [];
  }

  return database2.query(
    `SELECT
        payment.transaction_id AS "transactionId",
        payment.payment_method AS "paymentMethod",
        payment.amount AS "amount"
      FROM transaction_payments payment
      WHERE payment.deleted_at IS NULL
        AND payment.transaction_id = ANY($1)`,
    [transactionIds],
  );
};

export const loadFlm3OtherDocumentRows = async (
  database2: DataSource,
  transactionIds: string[],
): Promise<Flm3OtherDocumentRow[]> => {
  if (!transactionIds.length) {
    return [];
  }

  return database2.query(
    `SELECT
        document.transaction_id AS "transactionId",
        document.document_type AS "documentType",
        document.document_number AS "documentNumber",
        document.line_no AS "lineNo"
      FROM transaction_passenger_other_documents document
      WHERE document.deleted_at IS NULL
        AND document.transaction_id = ANY($1)
      ORDER BY document.line_no ASC`,
    [transactionIds],
  );
};

export const buildFlm3PurchaseFromPublic = (
  itemRows: Flm3ItemRow[],
  paymentRows: Flm3PaymentRow[],
  otherDocumentRows: Flm3OtherDocumentRow[],
  view?: string,
  options?: Flm3BuildOptions,
): Flm3ReportResponse => {
  const resolvedView = resolveView(view);
  const includePanColumns = Boolean(options?.includePanColumns);
  const columns = buildColumns(resolvedView, includePanColumns);

  const paymentsByTransaction = new Map<string, Flm3PaymentRow[]>();
  paymentRows.forEach((row) => {
    const current = paymentsByTransaction.get(row.transactionId) ?? [];
    current.push(row);
    paymentsByTransaction.set(row.transactionId, current);
  });

  const documentsByTransaction = new Map<string, Flm3OtherDocumentRow[]>();
  otherDocumentRows.forEach((row) => {
    const current = documentsByTransaction.get(row.transactionId) ?? [];
    current.push(row);
    documentsByTransaction.set(row.transactionId, current);
  });

  const netByTransaction = new Map<string, number>();
  const firstLineByTransaction = new Map<string, number>();
  itemRows.forEach((row) => {
    netByTransaction.set(
      row.transactionId,
      (netByTransaction.get(row.transactionId) ?? 0) + toNumber(row.amount),
    );
    const lineNo = toNumber(row.lineNo);
    const currentFirst = firstLineByTransaction.get(row.transactionId);
    if (currentFirst === undefined || lineNo < currentFirst) {
      firstLineByTransaction.set(row.transactionId, lineNo);
    }
  });

  const totals = {
    feAmount: 0,
    rupeeEquivalent: 0,
    netAmount: 0,
    commissionAmount: 0,
    byCash: 0,
    byCheque: 0,
    byOther: 0,
  };

  const rows: Flm3ReportRow[] = itemRows.map((row) => {
    const passengerSnapshot = parseSnapshot(row.passengerSnapshot);
    const currencySnapshot = parseSnapshot(row.currencySnapshot);
    const productSnapshot = parseSnapshot(row.productSnapshot);
    const lineNo = toNumber(row.lineNo);
    const isFirstItem =
      lineNo === (firstLineByTransaction.get(row.transactionId) ?? lineNo);
    const feAmount = toNumber(row.quantity);
    const rupeeEquivalent = toNumber(row.amount);
    const commissionAmount = toNumber(row.commission);
    const payments = buildPaymentBuckets(
      paymentsByTransaction.get(row.transactionId) ?? [],
      toNumber(row.loanAmount),
    );
    const netAmount = netByTransaction.get(row.transactionId) ?? 0;

    totals.feAmount += feAmount;
    totals.rupeeEquivalent += rupeeEquivalent;
    totals.commissionAmount += commissionAmount;
    if (isFirstItem) {
      totals.netAmount += netAmount;
      totals.byCash += payments.byCash;
      totals.byCheque += payments.byCheque;
      totals.byOther += payments.byOther;
    }

    const displayDate = formatDisplayDate(row.transactionDate);
    const nextRow: Flm3ReportRow = {
      rowType: "ITEM",
      transactionId: row.transactionId,
      date: displayDate,
      srNo: String(row.lineNo ?? ""),
      customerName: snapshotText(passengerSnapshot.panHolderName),
      nationality: snapshotText(passengerSnapshot.nationalityType),
      fullAddress: buildFullAddress(passengerSnapshot),
      identificationDocument: buildIdentificationDocument(
        passengerSnapshot,
        documentsByTransaction.get(row.transactionId) ?? [],
      ),
      currency: snapshotCode(currencySnapshot),
      feAmount: formatQuantity(feAmount),
      rate: formatRateLabel(toNumber(row.rate), toNumber(row.per)),
      rupeeEquivalent: formatAmount(rupeeEquivalent),
      transactionNo: String(row.transactionNumber ?? ""),
      transactionDate: displayDate,
      product: snapshotCode(productSnapshot) || FLM1_DEFAULT_PRODUCT_CODE,
      passengerPan: includePanColumns
        ? snapshotText(passengerSnapshot.panNumber)
        : "",
      remitterPan: includePanColumns
        ? snapshotText(passengerSnapshot.paidByPanNumber)
        : "",
      commissionAmount: formatAmount(commissionAmount),
      netAmount: "",
      byCash: "",
      byCheque: "",
      byOther: "",
    };

    if (resolvedView === Flm3PurchaseFromPublicView.EXTENDED && isFirstItem) {
      nextRow.netAmount = formatAmount(netAmount);
      nextRow.byCash = formatAmount(payments.byCash);
      nextRow.byCheque = formatAmount(payments.byCheque);
      nextRow.byOther = formatAmount(payments.byOther);
    }

    return nextRow;
  });

  if (rows.length) {
    rows.push({
      rowType: "TOTAL",
      transactionId: "",
      date: "Total",
      srNo: "",
      customerName: "",
      nationality: "",
      fullAddress: "",
      identificationDocument: "",
      currency: "",
      feAmount: formatQuantity(totals.feAmount),
      rate: "",
      rupeeEquivalent: formatAmount(totals.rupeeEquivalent),
      transactionNo: "",
      transactionDate: "",
      product: "",
      passengerPan: "",
      remitterPan: "",
      commissionAmount: formatAmount(totals.commissionAmount),
      netAmount:
        resolvedView === Flm3PurchaseFromPublicView.EXTENDED
          ? formatAmount(totals.netAmount)
          : "",
      byCash:
        resolvedView === Flm3PurchaseFromPublicView.EXTENDED
          ? formatAmount(totals.byCash)
          : "",
      byCheque:
        resolvedView === Flm3PurchaseFromPublicView.EXTENDED
          ? formatAmount(totals.byCheque)
          : "",
      byOther:
        resolvedView === Flm3PurchaseFromPublicView.EXTENDED
          ? formatAmount(totals.byOther)
          : "",
    });
  }

  return {
    view: resolvedView,
    columns,
    rows,
    totals: {
      feAmount: formatQuantity(totals.feAmount),
      rupeeEquivalent: formatAmount(totals.rupeeEquivalent),
      netAmount: formatAmount(totals.netAmount),
      commissionAmount: formatAmount(totals.commissionAmount),
      byCash: formatAmount(totals.byCash),
      byCheque: formatAmount(totals.byCheque),
      byOther: formatAmount(totals.byOther),
    },
  };
};

export const buildFlm3PurchaseFromPublicExport = (
  report: Flm3ReportResponse,
  format: CardSettlementReportFormat,
) => {
  const sheetRows = [
    report.columns.map((column) => column.label),
    ...report.rows.map((row) =>
      report.columns.map((column) => row[column.key] ?? ""),
    ),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);

  if (format === CardSettlementReportFormat.CSV) {
    return {
      buffer: Buffer.from(XLSX.utils.sheet_to_csv(worksheet), "utf8"),
      contentType: "text/csv; charset=utf-8",
      filename: "flm3-purchase-from-public.csv",
    };
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "FLM3");
  return {
    buffer: XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    }) as Buffer,
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: "flm3-purchase-from-public.xlsx",
  };
};
