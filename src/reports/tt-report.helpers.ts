import { BadRequestException } from "@nestjs/common";
import { DataSource } from "typeorm";
import * as XLSX from "xlsx";
import { toDisplayDateOnly, toUtcDateOnly, toUtcNextDate } from "../common/date/date.util";
import { ProductSettlementStatus } from "../product-settlement/product-settlement.enums";
import { TransactionStatus } from "../transactions/transactions.enums";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import { TtReportLayout } from "./dto/tt-report-query.dto";
import {
  projectTtReportRow,
  TT_REPORT_FORMATS,
} from "./tt-report.formats";

export const TT_PRODUCT_CODE = "TT";

export type TtReportColumnKey = string;

export interface TtReportRow {
  transactionId: string;
  [key: string]: string;
}

export interface TtReportResponse {
  startDate: string;
  endDate: string;
  blockedBatchAt: string | null;
  layout: TtReportLayout;
  message: string;
  columns: Array<{ key: TtReportColumnKey; label: string }>;
  rows: TtReportRow[];
}

type Snapshot = Record<string, unknown> | null;

interface SourceRow {
  transactionId: string;
  number: string | null;
  transactionDate: string | Date | null;
  blocked: boolean | null;
  quantity: string | null;
  rate: string | null;
  inrAmount: string | null;
  branchSnapshot: unknown;
  partyProfileSnapshot: unknown;
  purposeSnapshot: unknown;
  passengerSnapshot: unknown;
  currencySnapshot: unknown;
  dealCoverSnapshot: unknown;
  subpurposeSnapshot: unknown;
  remitterName: string | null;
  remitterAddress: string | null;
  remitterCity: string | null;
  remitterCountrySnapshot: unknown;
  remitterEntityType: string | null;
  beneficiaryName: string | null;
  beneficiaryAddress: string | null;
  beneficiaryCountrySnapshot: unknown;
  bankName: string | null;
  bankAddress: string | null;
  accountNumber: string | null;
  iban: string | null;
  swiftCode: string | null;
  bsbCode: string | null;
  sortCode: string | null;
  routingNumber: string | null;
  transitNumber: string | null;
  educationDetails: string | null;
  fbBearerOptionSnapshot: unknown;
  intermediaryBankName: string | null;
  intermediaryBankAddress: string | null;
  intermediaryBankCodes: string | null;
  relationship: string | null;
  dealNo: string | null;
}

const parseSnapshot = (value: unknown): Snapshot => {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return typeof value === "object" ? (value as Record<string, unknown>) : null;
};

const textOf = (value: unknown): string => {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).trim();
};

const snapshotText = (snapshot: unknown, keys: string[]): string => {
  const parsed = parseSnapshot(snapshot);
  if (!parsed) return "";
  for (const key of keys) {
    const value = textOf(parsed[key]);
    if (value) return value;
  }
  return "";
};

const joinText = (values: Array<string | null | undefined>): string =>
  values
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" / ");

const formatAmount = (value: string | null): string => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
};

const formatDate = (value: unknown): string => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const day = String(value.getDate()).padStart(2, "0");
    const month = String(value.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}/${value.getFullYear()}`;
  }
  if (typeof value === "string" || typeof value === "number") {
    return toDisplayDateOnly(String(value)) || "";
  }
  return "";
};

const formatRate = (value: string | null): string => {
  const rate = Number(value ?? 0);
  return Number.isFinite(rate) ? rate.toFixed(4) : "0.0000";
};

const firstText = (values: Array<string | null | undefined>): string =>
  values.map((value) => String(value ?? "").trim()).find(Boolean) ?? "";

export const resolveTtReportDateRange = (startDate?: string, endDate?: string) => {
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

export const loadTtReportRows = async (
  database2: DataSource,
  filters: {
    startDate: Date;
    endDateExclusive: Date;
    branchIds: string[];
    productId?: string;
    issuerPartyProfileIds: string[];
    issuerName?: string;
    showBlocked: boolean;
    showBeforeHoAcceptance: boolean;
    blockedBatchAt?: Date | null;
  },
): Promise<SourceRow[]> => {
  const params: unknown[] = [filters.startDate, filters.endDateExclusive];
  const conditions = [
    "tx.deleted_at IS NULL",
    "tx.is_latest = true",
    `tx.status = '${TransactionStatus.APPROVED}'`,
    "item.deleted_at IS NULL",
    "rem.deleted_at IS NULL",
    "tx.transaction_date >= $1",
    "tx.transaction_date < $2",
    `UPPER(BTRIM(COALESCE(item.product_snapshot->>'productCode', item.product_snapshot->>'code', ''))) = '${TT_PRODUCT_CODE}'`,
  ];

  if (filters.blockedBatchAt) {
    params.push(filters.blockedBatchAt);
    conditions.push(`tx.tt_report_blocked_at = $${params.length}`);
  } else if (!filters.showBlocked) {
    conditions.push("COALESCE(tx.tt_report_blocked, false) = false");
  }
  if (filters.branchIds.length) {
    params.push(filters.branchIds);
    conditions.push(`tx.branch_id = ANY($${params.length}::uuid[])`);
  }
  if (filters.productId) {
    params.push(filters.productId);
    conditions.push(`item.product_id = $${params.length}::uuid`);
  }
  if (filters.issuerPartyProfileIds.length) {
    params.push(filters.issuerPartyProfileIds);
    conditions.push(
      `item.issuer_party_profile_id = ANY($${params.length}::uuid[])`,
    );
  } else if (filters.issuerName) {
    params.push(`%${filters.issuerName}%`);
    conditions.push(`(
      COALESCE(item.issuer_party_profile_snapshot->>'code', '') ILIKE $${params.length}
      OR COALESCE(item.issuer_party_profile_snapshot->>'name', '') ILIKE $${params.length}
      OR COALESCE(item.issuer_party_profile_snapshot->>'label', '') ILIKE $${params.length}
    )`);
  }
  if (filters.showBeforeHoAcceptance) {
    conditions.push(`EXISTS (
      SELECT 1
      FROM product_settlements settlement
      WHERE settlement.transaction_id = tx.id
        AND settlement.deleted_at IS NULL
        AND settlement.status::text = '${ProductSettlementStatus.PENDING_HO_ACCEPTANCE}'
        AND UPPER(BTRIM(settlement.product_code::text)) = '${TT_PRODUCT_CODE}'
    )`);
  }

  return database2.query(
    `SELECT
        tx.id AS "transactionId",
        tx.number AS "number",
        tx.transaction_date::text AS "transactionDate",
        tx.tt_report_blocked AS "blocked",
        item.quantity AS "quantity",
        item.rate AS "rate",
        item.amount AS "inrAmount",
        tx.branch_snapshot AS "branchSnapshot",
        tx.party_profile_snapshot AS "partyProfileSnapshot",
        tx.purpose_snapshot AS "purposeSnapshot",
        tx.passenger_snapshot AS "passengerSnapshot",
        item.currency_snapshot AS "currencySnapshot",
        item.deal_cover_snapshot AS "dealCoverSnapshot",
        deal.subpurpose_snapshot AS "subpurposeSnapshot",
        rem.remitter_name AS "remitterName",
        rem.remitter_address AS "remitterAddress",
        rem.remitter_city AS "remitterCity",
        rem.remitter_country_snapshot AS "remitterCountrySnapshot",
        rem.remitter_entity_type AS "remitterEntityType",
        rem.beneficiary_name AS "beneficiaryName",
        rem.beneficiary_address AS "beneficiaryAddress",
        rem.beneficiary_country_snapshot AS "beneficiaryCountrySnapshot",
        rem.bank_name AS "bankName",
        rem.bank_address AS "bankAddress",
        rem.account_number AS "accountNumber",
        rem.iban AS "iban",
        rem.swift_code AS "swiftCode",
        rem.bsb_code AS "bsbCode",
        rem.sort_code AS "sortCode",
        rem.routing_number AS "routingNumber",
        rem.transit_number AS "transitNumber",
        rem.education_details AS "educationDetails",
        rem.fb_bearer_option_snapshot AS "fbBearerOptionSnapshot",
        rem.intermediary_bank_name AS "intermediaryBankName",
        rem.intermediary_bank_address AS "intermediaryBankAddress",
        rem.intermediary_bank_codes AS "intermediaryBankCodes",
        rem.relationship AS "relationship",
        deal.deal_no AS "dealNo"
      FROM transactions tx
      INNER JOIN transaction_items item ON item.transaction_id = tx.id
      INNER JOIN tt_remittance_details rem ON rem.transaction_id = tx.id
      LEFT JOIN deal_covers deal
        ON deal.id = item.deal_cover_id
        AND deal.deleted_at IS NULL
      WHERE ${conditions.join(" AND ")}
      ORDER BY tx.transaction_date ASC, tx.number ASC, item.line_no ASC`,
    params,
  );
};

export const markTtReportRowsBlocked = async (
  database2: DataSource,
  transactionIds: string[],
  actorId: string,
  blockedAt: Date,
) => {
  const ids = [...new Set(transactionIds.filter(Boolean))];
  if (!ids.length || !actorId) return;
  await database2.query(
    `UPDATE transactions
      SET tt_report_blocked = true,
          tt_report_blocked_at = $3,
          updated_at = NOW(),
          updated_by = $2::uuid
      WHERE id = ANY($1::uuid[])
        AND deleted_at IS NULL`,
    [ids, actorId, blockedAt],
  );
};

const blankAdditionalFields = (): Record<string, string> =>
  Object.fromEntries(
    Array.from({ length: 15 }, (_, index) => [
      `additionalField${index + 1}`,
      "",
    ]),
  );

const resolveTtFields = (
  row: SourceRow,
  markedNow: boolean,
): Record<string, string> => {
  const passenger = parseSnapshot(row.passengerSnapshot);
  const amount = formatAmount(row.quantity);
  const dealNo =
    textOf(row.dealNo) ||
    snapshotText(row.dealCoverSnapshot, ["dealNo", "code", "name"]);
  const entityType = (
    snapshotText(passenger, ["entityType"]) || textOf(row.remitterEntityType)
  ).toUpperCase();
  const panDob = formatDate(passenger?.panDob);
  const remitterName =
    textOf(row.remitterName) ||
    snapshotText(passenger, ["passportPassengerName", "name"]);
  const beneficiaryName = textOf(row.beneficiaryName);
  const tranDate = formatDate(row.transactionDate);

  return {
    transactionId: row.transactionId,
    valueDate: "",
    customerReference: textOf(row.number),
    partnerBranchCode: snapshotText(row.branchSnapshot, ["code"]),
    tranDate,
    mode: TT_PRODUCT_CODE,
    ddNumber: "",
    remitterId: snapshotText(row.partyProfileSnapshot, ["code"]),
    curr: snapshotText(row.currencySnapshot, ["code", "currencyCode"]),
    amount,
    rate: formatRate(row.rate),
    inr: formatAmount(row.inrAmount),
    dealId: dealNo,
    forwardBookingRef: dealNo,
    dealNo,
    dealAmount: amount,
    remitterName,
    remitterFName: remitterName,
    remitterMName: "",
    remitterLName: "",
    remitterType: entityType,
    remitterPan: snapshotText(passenger, ["panNumber"]),
    remitterAddress:
      textOf(row.remitterAddress) ||
      [
        snapshotText(passenger, ["address1"]),
        snapshotText(passenger, ["address2"]),
      ]
        .filter(Boolean)
        .join(", "),
    remitterCity: textOf(row.remitterCity) || snapshotText(passenger, ["city"]),
    remitterCountry: snapshotText(row.remitterCountrySnapshot, ["name", "code"]),
    beneficiaryName,
    beneficiaryFName: beneficiaryName,
    beneficiaryMName: "",
    beneficiaryLName: "",
    beneficiaryType: entityType,
    beneficiaryAddress: textOf(row.beneficiaryAddress),
    beneficiaryCity: "",
    beneCity: "",
    beneficiaryCountry: snapshotText(row.beneficiaryCountrySnapshot, [
      "name",
      "code",
    ]),
    beneCountry: snapshotText(row.beneficiaryCountrySnapshot, ["code", "name"]),
    beneficiaryAccount: textOf(row.accountNumber) || textOf(row.iban),
    beneBankName: textOf(row.bankName),
    beneBankAddress: textOf(row.bankAddress),
    beneBankCountry: "",
    beneBankWire: joinText([
      row.sortCode,
      row.bsbCode,
      row.routingNumber,
      row.transitNumber,
    ]),
    beneBankSwift: textOf(row.swiftCode),
    beneBankSort: firstText([
      row.sortCode,
      row.routingNumber,
      row.bsbCode,
      row.transitNumber,
    ]),
    subPurposeCode: snapshotText(row.subpurposeSnapshot, [
      "code",
      "name",
      "description",
    ]),
    purposeCode: snapshotText(row.purposeSnapshot, [
      "description",
      "name",
      "code",
    ]).toUpperCase(),
    additionalDetails: textOf(row.educationDetails),
    educationalDetails: textOf(row.educationDetails),
    correspondentBankCharges: "",
    fbCharges: snapshotText(row.fbBearerOptionSnapshot, [
      "code",
      "value",
      "label",
      "name",
    ]),
    intermBankName: textOf(row.intermediaryBankName),
    intermAddress: textOf(row.intermediaryBankAddress),
    intermBic: textOf(row.intermediaryBankCodes),
    intermWire: "",
    intermBankCountry: "",
    intermSortCode: "",
    entityType,
    merchantUserIdentity: entityType,
    remitterEmail: snapshotText(passenger, ["email"]),
    remitterMobile: snapshotText(passenger, ["contactNo"]),
    beneUserIdentity: entityType,
    dob: panDob,
    relation:
      snapshotText(passenger, ["panHolderRelationType"]) ||
      textOf(row.relationship),
    panHolderName: snapshotText(passenger, ["panHolderName"]),
    panHolderPan: snapshotText(passenger, ["panNumber"]),
    panHolderDob: panDob,
    ...blankAdditionalFields(),
    download: Boolean(row.blocked) || markedNow ? "Yes" : "No",
  };
};

export const buildTtReport = (
  sourceRows: SourceRow[],
  input: {
    startDate: string;
    endDate: string;
    markedNow: boolean;
    blockedBatchAt: string | null;
    layout: TtReportLayout;
  },
): TtReportResponse => {
  const format = TT_REPORT_FORMATS[input.layout];
  return {
    startDate: input.startDate,
    endDate: input.endDate,
    blockedBatchAt: input.blockedBatchAt,
    layout: input.layout,
    message: sourceRows.length ? "" : format.emptyMessage,
    columns: format.columns.map((column) => ({ ...column })),
    rows: sourceRows.map(
      (row) =>
        projectTtReportRow(
          resolveTtFields(row, input.markedNow),
          format.columns,
        ) as TtReportRow,
    ),
  };
};

export const buildTtReportExport = (
  report: TtReportResponse,
  exportFormat: CardSettlementReportFormat,
) => {
  const extension =
    exportFormat === CardSettlementReportFormat.CSV ? "csv" : "xlsx";
  const layoutFormat = TT_REPORT_FORMATS[report.layout];
  const filename = `${layoutFormat.filePrefix}-${report.startDate}-to-${report.endDate}.${extension}`;
  if (exportFormat === CardSettlementReportFormat.CSV) {
    const header = report.columns.map((column) => column.label).join(",");
    const lines = report.rows.map((row) =>
      report.columns
        .map((column) => {
          const value = String(row[column.key] ?? "");
          return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
        })
        .join(","),
    );
    const csv =
      report.message && !report.rows.length
        ? report.message
        : [header, ...lines].join("\n");
    return {
      filename,
      contentType: "text/csv; charset=utf-8",
      buffer: Buffer.from(csv, "utf8"),
    };
  }

  const sheet = XLSX.utils.aoa_to_sheet(
    report.message && !report.rows.length
      ? [[report.message]]
      : [
          report.columns.map((column) => column.label),
          ...report.rows.map((row) =>
            report.columns.map((column) => row[column.key] ?? ""),
          ),
        ],
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, layoutFormat.sheetName);
  return {
    filename,
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    }) as Buffer,
  };
};
