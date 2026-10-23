import { BadRequestException } from "@nestjs/common";
import PDFDocument from "pdfkit";
import { DataSource } from "typeorm";
import * as XLSX from "xlsx";
import {
  toDateOnlyString,
  toDisplayDateOnly,
  toUtcDateOnly,
  toUtcNextDate,
} from "../common/date/date.util";
import {
  TradeMode,
  TransactionStatus,
  TransactionType,
  TransactionTypeProfileEnum,
} from "../transactions/transactions.enums";
import {
  LrsDailyReportExportFormat,
  LrsDailyReportFormat,
} from "./dto/lrs-daily-report-query.dto";

export const LRS_RETURN_NAME = "Liberalised Remittance Scheme";
export const LRS_RETURN_CODE = "R010";
export const LRS_FREQUENCY = "D";

export const LRS_COLUMN_DEFINITIONS = [
  { key: "recordIdentifier", label: "Record identifier" },
  { key: "panOfRemitter", label: "PAN of remitter" },
  { key: "nameOfRemitter", label: "Name of remitter" },
  { key: "aadhaarNumber", label: "Aadhar of remitter" },
  { key: "beneficiaryCountryCode", label: "Beneficiary's country code" },
  { key: "dateOfRemittance", label: "Date of remittance" },
  { key: "purposeCode", label: "Purpose Code" },
  { key: "currencyCode", label: "Currency code" },
  { key: "amountUsd", label: "Amount (Amount in USD)" },
  { key: "amountInr", label: "Amount (Amount in INR)" },
  { key: "remarks", label: "Remarks/Any other comments" },
] as const;

export type LrsDailyReportColumnKey =
  (typeof LRS_COLUMN_DEFINITIONS)[number]["key"];

export type LrsDailyReportRow = Record<LrsDailyReportColumnKey, string>;

export type LrsDailyReportSourceRow = {
  transactionDate: string | Date;
  transactionNumber: string | null;
  lineNo: number | string | null;
  amount: string | number | null;
  purposeId?: string | null;
  passengerSnapshot: Record<string, unknown> | null;
  passengerTravelSnapshot: Record<string, unknown> | null;
  purposeSnapshot: Record<string, unknown> | null;
  currencySnapshot: Record<string, unknown> | null;
  productSnapshot: Record<string, unknown> | null;
};

export type LrsDailyReport = {
  startDate: string;
  endDate: string;
  date: string;
  reportFormat: LrsDailyReportFormat;
  bankName: string;
  bankCode: string;
  usdRate: string;
  columns: Array<{ key: LrsDailyReportColumnKey; label: string }>;
  rows: LrsDailyReportRow[];
  uploadLines: string[];
  totalAmountUsd: string;
  totalAmountInr: string;
  recordCount: number;
};

export type LrsTourPassenger = {
  transactionNumber: string;
  panNumber: string;
  panName: string;
  fcnCode: string;
  fcnAmount: number;
  remark: string;
};

export type LrsDailyReportFile = {
  buffer: Buffer;
  contentType: string;
  filename: string;
};

const COLUMN_WIDTHS: Record<LrsDailyReportColumnKey, number> = {
  recordIdentifier: 6,
  panOfRemitter: 12,
  nameOfRemitter: 28,
  aadhaarNumber: 12,
  beneficiaryCountryCode: 6,
  dateOfRemittance: 12,
  purposeCode: 8,
  currencyCode: 6,
  amountUsd: 14,
  amountInr: 16,
  remarks: 28,
};

const snapshotText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

export const sanitizeLrsField = (value: string) =>
  value
    .replace(/[;\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const roundLrsMoney = (value: number) => {
  if (!Number.isFinite(value)) {
    return "0.00";
  }

  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return rounded.toFixed(2);
};

const addMoney = (left: string, right: string) => {
  const total = Number(left) + Number(right);
  return roundLrsMoney(Number.isFinite(total) ? total : 0);
};

const nestedRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readSnapshotCode = (
  snapshot: Record<string, unknown> | null,
  alias: string,
) => snapshotText(snapshot?.code) || snapshotText(snapshot?.[alias]);

export const resolveLrsReportDateRange = (
  startDate?: string,
  endDate?: string,
) => {
  if (!startDate) {
    throw new BadRequestException("Start date is required");
  }

  const resolvedEnd = endDate || startDate;
  const start = toUtcDateOnly(startDate);
  const endDateExclusive = toUtcNextDate(resolvedEnd);
  if (Number.isNaN(start.getTime()) || !endDateExclusive) {
    throw new BadRequestException("Invalid date range");
  }
  if (start.getTime() >= endDateExclusive.getTime()) {
    throw new BadRequestException("Start date cannot be after end date");
  }

  return {
    startDate: start,
    endDateExclusive,
    startLabel: startDate.slice(0, 10),
    endLabel: resolvedEnd.slice(0, 10),
  };
};

export const toCompactDisplayDate = (isoDate: string) => {
  const [year, month, day] = isoDate.slice(0, 10).split("-");
  if (!year || !month || !day) {
    return "";
  }

  return `${day}${month}${year}`;
};

const compareSourceRows = (
  left: LrsDailyReportSourceRow,
  right: LrsDailyReportSourceRow,
) => {
  const leftDate = toDateOnlyString(left.transactionDate) ?? "";
  const rightDate = toDateOnlyString(right.transactionDate) ?? "";
  if (leftDate !== rightDate) {
    return leftDate < rightDate ? -1 : 1;
  }

  const leftNumber = left.transactionNumber ?? "";
  const rightNumber = right.transactionNumber ?? "";
  if (leftNumber !== rightNumber) {
    return leftNumber < rightNumber ? -1 : 1;
  }

  return (Number(left.lineNo) || 0) - (Number(right.lineNo) || 0);
};

export const buildLrsPartyProfileCondition = (
  includeCorporateTransactions: boolean,
) => {
  const individual =
    "COALESCE(tx.party_profile_snapshot->>'isIndividual', '') = 'true'";
  if (!includeCorporateTransactions) {
    return individual;
  }

  const proprietorship = ["label", "value", "name"]
    .map(
      (key) =>
        `UPPER(COALESCE(tx.party_profile_snapshot->'entityType'->>'${key}', '')) LIKE '%PROPRIETORSHIP%'`,
    )
    .join(" OR ");

  return `(${individual} OR ${proprietorship})`;
};

const readCountryCode = (row: LrsDailyReportSourceRow) => {
  const travel = nestedRecord(row.passengerTravelSnapshot);
  const country = nestedRecord(travel?.travellingCountry);
  return sanitizeLrsField(snapshotText(country?.lrsCountryCode)).toUpperCase();
};

export const mapLrsDailyReportRow = (
  row: LrsDailyReportSourceRow,
  usdRate: number,
  recordIdentifier: number,
  rbiCodeByPurposeId?: ReadonlyMap<string, string>,
): LrsDailyReportRow => {
  const passenger = nestedRecord(row.passengerSnapshot);
  const inrAmount = Number(row.amount ?? 0);
  const inr = roundLrsMoney(Number.isFinite(inrAmount) ? inrAmount : 0);
  const usd = roundLrsMoney(
    (Number.isFinite(inrAmount) ? inrAmount : 0) / usdRate,
  );
  const voucherNumber = sanitizeLrsField(row.transactionNumber ?? "");
  const productCode = sanitizeLrsField(
    readSnapshotCode(nestedRecord(row.productSnapshot), "productCode"),
  ).toUpperCase();
  const remarks = [voucherNumber, productCode].filter(Boolean).join(" ");

  return {
    recordIdentifier: String(recordIdentifier),
    panOfRemitter: sanitizeLrsField(snapshotText(passenger?.panNumber)),
    nameOfRemitter: sanitizeLrsField(snapshotText(passenger?.panHolderName)),
    aadhaarNumber: "",
    beneficiaryCountryCode: readCountryCode(row),
    dateOfRemittance: toDisplayDateOnly(row.transactionDate),
    purposeCode: sanitizeLrsField(
      (row.purposeId ? rbiCodeByPurposeId?.get(row.purposeId) : "") ||
        snapshotText(nestedRecord(row.purposeSnapshot)?.rbiCode),
    ).toUpperCase(),
    currencyCode: sanitizeLrsField(
      readSnapshotCode(nestedRecord(row.currencySnapshot), "currencyCode"),
    ).toUpperCase(),
    amountUsd: usd,
    amountInr: inr,
    remarks,
  };
};

export const buildLrsUploadLines = (input: {
  date: string;
  bankName: string;
  bankCode: string;
  rows: LrsDailyReportRow[];
  totalAmountUsd: string;
  totalAmountInr: string;
}) => {
  const header = LRS_COLUMN_DEFINITIONS.map((column) => column.label).join(";");
  const dataLines = input.rows.map((row) =>
    LRS_COLUMN_DEFINITIONS.map((column) => row[column.key]).join(";"),
  );

  return [
    "Table Start",
    `Filing Information;${LRS_RETURN_CODE}-T001`,
    "Return Name;Return Code;Bank Name;Bank Code;Frequency;Reporting End Date",
    [
      LRS_RETURN_NAME,
      LRS_RETURN_CODE,
      sanitizeLrsField(input.bankName),
      sanitizeLrsField(input.bankCode),
      LRS_FREQUENCY,
      toCompactDisplayDate(input.date),
    ].join(";"),
    "Table Start",
    `${LRS_RETURN_NAME};${LRS_RETURN_CODE}-T002`,
    header,
    ...dataLines,
    "Table Start",
    `Total Amount (Amount in USD);${LRS_RETURN_CODE}-T003`,
    "particulars;Value",
    `Total Amount;${input.totalAmountUsd}`,
    "Table Start",
    `Total Amount (Amount in INR);${LRS_RETURN_CODE}-T004`,
    "particulars;Value",
    `Total Amount;${input.totalAmountInr}`,
    "Table Start",
    `Record Count;${LRS_RETURN_CODE}-T005`,
    "particulars;Value",
    `Record Count;${input.rows.length}`,
  ];
};

export const buildLrsDailyReport = (
  sourceRows: LrsDailyReportSourceRow[],
  input: {
    date: string;
    startDate?: string;
    endDate?: string;
    usdRate: number;
    bankName?: string;
    bankCode?: string;
    reportFormat?: LrsDailyReportFormat;
    rbiCodeByPurposeId?: ReadonlyMap<string, string>;
    showTourPaxBreakup?: boolean;
    tourPassengers?: LrsTourPassenger[];
  },
): LrsDailyReport => {
  if (!Number.isFinite(input.usdRate) || input.usdRate <= 0) {
    throw new BadRequestException("USD rate must be greater than 0");
  }

  const endDate = (input.endDate ?? input.date).slice(0, 10);
  const startDate = (input.startDate ?? endDate).slice(0, 10);
  const bankName = input.bankName?.trim() ?? "";
  const bankCode = input.bankCode?.trim() ?? "";
  const sortedSourceRows = [...sourceRows].sort(compareSourceRows);
  const officialRows = sortedSourceRows.map((row, index) =>
    mapLrsDailyReportRow(
      row,
      input.usdRate,
      index + 1,
      input.rbiCodeByPurposeId,
    ),
  );
  const rows = input.showTourPaxBreakup
    ? insertTourPassengerRows(
        sortedSourceRows,
        officialRows,
        input.tourPassengers ?? [],
        input.usdRate,
      )
    : officialRows;
  const totalAmountUsd = officialRows.reduce(
    (total, row) => addMoney(total, row.amountUsd),
    "0.00",
  );
  const totalAmountInr = officialRows.reduce(
    (total, row) => addMoney(total, row.amountInr),
    "0.00",
  );

  return {
    startDate,
    endDate,
    date: endDate,
    reportFormat: input.reportFormat ?? LrsDailyReportFormat.CIMS,
    bankName,
    bankCode,
    usdRate: String(input.usdRate),
    columns: LRS_COLUMN_DEFINITIONS.map((column) => ({ ...column })),
    rows,
    uploadLines: buildLrsUploadLines({
      date: endDate,
      bankName,
      bankCode,
      rows: officialRows,
      totalAmountUsd,
      totalAmountInr,
    }),
    totalAmountUsd,
    totalAmountInr,
    recordCount: officialRows.length,
  };
};

const currencyCodeOf = (row: LrsDailyReportSourceRow) =>
  sanitizeLrsField(
    readSnapshotCode(nestedRecord(row.currencySnapshot), "currencyCode"),
  ).toUpperCase();

const tourPassengerKey = (transactionNumber: string, fcnCode: string) =>
  `${transactionNumber}::${fcnCode}`;

const insertTourPassengerRows = (
  sourceRows: LrsDailyReportSourceRow[],
  officialRows: LrsDailyReportRow[],
  tourPassengers: LrsTourPassenger[],
  usdRate: number,
): LrsDailyReportRow[] => {
  const passengersByCurrency = new Map<string, LrsTourPassenger[]>();
  tourPassengers.forEach((passenger) => {
    const key = tourPassengerKey(passenger.transactionNumber, passenger.fcnCode);
    const current = passengersByCurrency.get(key) ?? [];
    current.push(passenger);
    passengersByCurrency.set(key, current);
  });

  const amountByCurrency = new Map<string, number>();
  sourceRows.forEach((row) => {
    const transactionNumber = sanitizeLrsField(row.transactionNumber ?? "");
    const key = tourPassengerKey(transactionNumber, currencyCodeOf(row));
    const amount = Number(row.amount ?? 0);
    amountByCurrency.set(
      key,
      (amountByCurrency.get(key) ?? 0) + (Number.isFinite(amount) ? amount : 0),
    );
  });

  const used = new Set<string>();
  const displayRows: LrsDailyReportRow[] = [];
  sourceRows.forEach((source, index) => {
    const official = officialRows[index];
    displayRows.push(official);
    const transactionNumber = sanitizeLrsField(source.transactionNumber ?? "");
    const key = tourPassengerKey(transactionNumber, official.currencyCode);
    if (used.has(key)) {
      return;
    }
    const passengers = passengersByCurrency.get(key) ?? [];
    if (!passengers.length) {
      return;
    }
    used.add(key);
    const totalFcn = passengers.reduce(
      (total, passenger) => total + passenger.fcnAmount,
      0,
    );
    const currencyInr = amountByCurrency.get(key) ?? 0;
    passengers.forEach((passenger) => {
      const share =
        totalFcn > 0 ? (currencyInr * passenger.fcnAmount) / totalFcn : 0;
      const inr = roundLrsMoney(share);
      displayRows.push({
        ...official,
        panOfRemitter: sanitizeLrsField(passenger.panNumber),
        nameOfRemitter: sanitizeLrsField(passenger.panName),
        currencyCode: passenger.fcnCode,
        amountInr: inr,
        amountUsd: roundLrsMoney(share / usdRate),
        remarks: sanitizeLrsField(passenger.remark) || official.remarks,
      });
    });
  });

  return displayRows.map((row, index) => ({
    ...row,
    recordIdentifier: String(index + 1),
  }));
};

export const loadLrsDailyReportSourceRows = async (
  database2: DataSource,
  filters: {
    startDate: Date;
    endDateExclusive: Date;
    branchIds: string[];
    productId?: string;
    issuerPartyProfileId?: string;
    purposeIds: string[];
    includeCorporateTransactions?: boolean;
  },
): Promise<LrsDailyReportSourceRow[]> => {
  const params: unknown[] = [filters.startDate, filters.endDateExclusive];
  const conditions = [
    "tx.deleted_at IS NULL",
    "item.deleted_at IS NULL",
    "tx.is_latest = true",
    `tx.status = '${TransactionStatus.APPROVED}'`,
    `tx.transaction_type = '${TransactionType.SALE}'`,
    `tx.trade_mode = '${TradeMode.RETAIL}'`,
    `tx.slug = '${TransactionTypeProfileEnum.SALE_CORPORATE_INDIVIDUAL}'`,
    "tx.transaction_date >= $1",
    "tx.transaction_date < $2",
    "COALESCE(item.product_snapshot->>'availableInRetailSelling', '') = 'true'",
    "COALESCE(item.product_snapshot->>'allowProductCancellation', 'false') <> 'true'",
    buildLrsPartyProfileCondition(
      filters.includeCorporateTransactions === true,
    ),
  ];

  if (!filters.purposeIds.length) {
    return [];
  }

  if (filters.branchIds.length) {
    const placeholders = filters.branchIds.map((branchId) => {
      params.push(branchId);
      return `$${params.length}`;
    });
    conditions.push(`tx.branch_id IN (${placeholders.join(", ")})`);
  }

  if (filters.productId) {
    params.push(filters.productId);
    conditions.push(`item.product_id = $${params.length}`);
  }

  if (filters.issuerPartyProfileId) {
    params.push(filters.issuerPartyProfileId);
    conditions.push(`item.issuer_party_profile_id = $${params.length}`);
  }

  const purposePlaceholders = filters.purposeIds.map((purposeId) => {
    params.push(purposeId);
    return `$${params.length}`;
  });
  conditions.push(`tx.purpose_id IN (${purposePlaceholders.join(", ")})`);

  return database2.query(
    `SELECT
        tx.transaction_date AS "transactionDate",
        tx.number AS "transactionNumber",
        item.line_no AS "lineNo",
        item.amount AS "amount",
        tx.purpose_id AS "purposeId",
        tx.passenger_snapshot AS "passengerSnapshot",
        tx.passenger_travel_snapshot AS "passengerTravelSnapshot",
        tx.purpose_snapshot AS "purposeSnapshot",
        item.currency_snapshot AS "currencySnapshot",
        item.product_snapshot AS "productSnapshot"
      FROM transaction_items item
      INNER JOIN transactions tx ON tx.id = item.transaction_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY tx.transaction_date ASC, tx.number ASC NULLS LAST, item.line_no ASC`,
    params,
  );
};

const tourPaxText = (value: unknown) => String(value ?? "").trim();

export const loadLrsTourPaxRows = async (
  database2: DataSource,
  filters: {
    startDate: Date;
    endDateExclusive: Date;
    branchIds: string[];
    productId?: string;
    issuerPartyProfileId?: string;
    purposeIds: string[];
    includeCorporateTransactions?: boolean;
  },
): Promise<LrsTourPassenger[]> => {
  if (!filters.purposeIds.length) {
    return [];
  }

  const params: unknown[] = [filters.startDate, filters.endDateExclusive];
  const conditions = [
    "tp.deleted_at IS NULL",
    "tx.deleted_at IS NULL",
    "tx.is_latest = true",
    `tx.status = '${TransactionStatus.APPROVED}'`,
    `tx.transaction_type = '${TransactionType.SALE}'`,
    `tx.trade_mode = '${TradeMode.RETAIL}'`,
    `tx.slug = '${TransactionTypeProfileEnum.SALE_CORPORATE_INDIVIDUAL}'`,
    "tx.transaction_date >= $1",
    "tx.transaction_date < $2",
    buildLrsPartyProfileCondition(
      filters.includeCorporateTransactions === true,
    ),
  ];

  if (filters.branchIds.length) {
    const placeholders = filters.branchIds.map((branchId) => {
      params.push(branchId);
      return `$${params.length}`;
    });
    conditions.push(`tx.branch_id IN (${placeholders.join(", ")})`);
  }

  const purposePlaceholders = filters.purposeIds.map((purposeId) => {
    params.push(purposeId);
    return `$${params.length}`;
  });
  conditions.push(`tx.purpose_id IN (${purposePlaceholders.join(", ")})`);

  const itemConditions = [
    "item.transaction_id = tx.id",
    "item.deleted_at IS NULL",
    "COALESCE(item.product_snapshot->>'availableInRetailSelling', '') = 'true'",
    "COALESCE(item.product_snapshot->>'allowProductCancellation', 'false') <> 'true'",
  ];
  if (filters.productId) {
    params.push(filters.productId);
    itemConditions.push(`item.product_id = $${params.length}`);
  }
  if (filters.issuerPartyProfileId) {
    params.push(filters.issuerPartyProfileId);
    itemConditions.push(`item.issuer_party_profile_id = $${params.length}`);
  }
  conditions.push(
    `EXISTS (SELECT 1 FROM transaction_items item WHERE ${itemConditions.join(" AND ")})`,
  );

  const rows = (await database2.query(
    `SELECT
        tx.number AS "transactionNumber",
        tp.traveller_pan_number AS "panNumber",
        tp.pan_name AS "panName",
        tp.passport_name AS "passportName",
        tp.fcn_code AS "fcnCode",
        tp.fcn_amount AS "fcnAmount",
        tp.remark AS "remark"
      FROM tour_passengers tp
      INNER JOIN transactions tx ON tx.id = tp.transaction_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY tx.transaction_date ASC, tx.number ASC NULLS LAST, tp.line_no ASC`,
    params,
  )) as Array<{
    transactionNumber: string | null;
    panNumber: string | null;
    panName: string | null;
    passportName: string | null;
    fcnCode: string | null;
    fcnAmount: string | number | null;
    remark: string | null;
  }>;

  return rows.flatMap((row) => {
    const fcnAmount = Number(row.fcnAmount ?? NaN);
    const fcnCode = tourPaxText(row.fcnCode).toUpperCase();
    if (!fcnCode || !Number.isFinite(fcnAmount)) {
      return [];
    }
    return [
      {
        transactionNumber: sanitizeLrsField(tourPaxText(row.transactionNumber)),
        panNumber: tourPaxText(row.panNumber),
        panName: tourPaxText(row.panName) || tourPaxText(row.passportName),
        fcnCode,
        fcnAmount,
        remark: tourPaxText(row.remark),
      },
    ];
  });
};

const reportFileLabel = (report: LrsDailyReport) =>
  report.startDate === report.endDate
    ? report.endDate
    : `${report.startDate}-to-${report.endDate}`;

const fileName = (report: LrsDailyReport, extension: string) =>
  `lrs-daily-report-${reportFileLabel(report)}.${extension}`;

const buildCimsTextLines = (report: LrsDailyReport) => {
  const header = LRS_COLUMN_DEFINITIONS.map((column) => column.label).join(";");
  const rows = report.rows.map((row) =>
    LRS_COLUMN_DEFINITIONS.map((column) => row[column.key]).join(";"),
  );
  return [header, ...rows];
};

const isUploadFormat = (report: LrsDailyReport) =>
  report.reportFormat === LrsDailyReportFormat.CIMS_UPLOAD;

export const buildLrsDailyReportTxt = (
  report: LrsDailyReport,
): LrsDailyReportFile => {
  const lines = isUploadFormat(report)
    ? report.uploadLines
    : buildCimsTextLines(report);
  return {
    buffer: Buffer.from(`${lines.join("\n")}\n`, "utf8"),
    contentType: "text/plain; charset=utf-8",
    filename: fileName(report, "txt"),
  };
};

export const buildLrsDailyReportExcel = (
  report: LrsDailyReport,
): LrsDailyReportFile => {
  const sheetRows = isUploadFormat(report)
    ? [["COLUMN1"], ...report.uploadLines.map((line) => [line])]
    : [
        LRS_COLUMN_DEFINITIONS.map((column) => column.label),
        ...report.rows.map((row) =>
          LRS_COLUMN_DEFINITIONS.map((column) => row[column.key]),
        ),
      ];
  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "LRS Daily");

  return {
    buffer: XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    }) as Buffer,
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: fileName(report, "xlsx"),
  };
};

const padColumn = (value: string, width: number) => {
  const text = value.length > width ? value.slice(0, width) : value;
  return text.padEnd(width, " ");
};

const reportDateLabel = (report: LrsDailyReport) => {
  const start = toDisplayDateOnly(report.startDate);
  const end = toDisplayDateOnly(report.endDate);
  return start === end ? start : `${start} to ${end}`;
};

const buildCimsPdfLines = (report: LrsDailyReport) => {
  const header = LRS_COLUMN_DEFINITIONS.map((column) =>
    padColumn(column.label, COLUMN_WIDTHS[column.key]),
  ).join(" ");
  const rows = report.rows.map((row) =>
    LRS_COLUMN_DEFINITIONS.map((column) =>
      padColumn(row[column.key], COLUMN_WIDTHS[column.key]),
    ).join(" "),
  );

  return [
    "LRS Daily Report",
    `Date ${reportDateLabel(report)}  USD rate ${report.usdRate}`,
    `Total USD ${report.totalAmountUsd}  Total INR ${report.totalAmountInr}  Records ${report.recordCount}`,
    "",
    header,
    ...rows,
  ];
};

const toPdfAscii = (value: string) => value.replace(/[^\x20-\x7E]/g, " ");

const buildPdfDocument = (lines: string[], landscape: boolean) =>
  new Promise<Buffer>((resolve, reject) => {
    const document = new PDFDocument({
      size: "A4",
      layout: landscape ? "landscape" : "portrait",
      margin: 24,
      compress: false,
    });
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
    document.font("Courier").fontSize(landscape ? 6 : 8);
    lines.forEach((line) => {
      document.text(toPdfAscii(line), { lineGap: 1 });
    });
    document.end();
  });

export const buildLrsDailyReportPdf = async (
  report: LrsDailyReport,
): Promise<LrsDailyReportFile> => {
  const uploadFormat = report.reportFormat === LrsDailyReportFormat.CIMS_UPLOAD;
  const lines = uploadFormat ? report.uploadLines : buildCimsPdfLines(report);

  return {
    buffer: await buildPdfDocument(lines, !uploadFormat),
    contentType: "application/pdf",
    filename: fileName(report, "pdf"),
  };
};

export const buildLrsDailyReportExport = async (
  report: LrsDailyReport,
  format: LrsDailyReportExportFormat,
): Promise<LrsDailyReportFile> => {
  if (format === LrsDailyReportExportFormat.TXT) {
    return buildLrsDailyReportTxt(report);
  }

  if (format === LrsDailyReportExportFormat.PDF) {
    return buildLrsDailyReportPdf(report);
  }

  return buildLrsDailyReportExcel(report);
};
