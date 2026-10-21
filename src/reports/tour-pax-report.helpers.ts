import { DataSource } from "typeorm";
import * as XLSX from "xlsx";
import { toDisplayDateOnly } from "../common/date/date.util";
import { TransactionStatus } from "../transactions/transactions.enums";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import { resolveFlm3DateRange } from "./flm3-purchase-from-public.helpers";

export const resolveTourPaxDateRange = resolveFlm3DateRange;

export type TourPaxColumn = { key: string; label: string };
export type TourPaxRow = Record<string, string> & { lineKey: string };

export type TourPaxReportResponse = {
  startDate: string;
  endDate: string;
  message: string;
  columns: TourPaxColumn[];
  rows: TourPaxRow[];
};

const COLUMNS: TourPaxColumn[] = [
  { key: "branchName", label: "BRANCH NAME" },
  { key: "invoiceNo", label: "INVOICE NO" },
  { key: "invoiceDate", label: "INVOICE DATE" },
  { key: "partyCode", label: "PARTY CODE" },
  { key: "partyName", label: "PARTY NAME" },
  { key: "agentCode", label: "AGENT CODE" },
  { key: "agentName", label: "AGENT NAME" },
  { key: "purposeCode", label: "PURPOSE CODE" },
  { key: "subpurposeCode", label: "SUBPURPOSE CODE" },
  { key: "issuerCode", label: "ISSUER CODE" },
  { key: "marketingReference", label: "MARKETING REFERENCE" },
  { key: "airline", label: "AIRLINE" },
  { key: "travellingCountry", label: "TRAVELLING COUNTRY" },
  { key: "dateOfDeparture", label: "DATE OF DEPARTURE" },
  { key: "travelPnr", label: "TRAVEL PNR" },
  { key: "srNo", label: "SR NO" },
  { key: "passportNumber", label: "PASSPORT NUMBER" },
  { key: "passportName", label: "NAME AS PER THE PASSPORT" },
  { key: "placeOfIssue", label: "PLACE OF ISSUE" },
  { key: "dateOfIssue", label: "DATE OF ISSUE" },
  { key: "dateOfExpiry", label: "DATE OF EXPIRY" },
  { key: "panHolderRelation", label: "RELATIONSHIP WITH PAN HOLDER" },
  { key: "travellerPan", label: "TRAVELLER PAN NUMBER" },
  { key: "panName", label: "NAME AS PER THE PAN" },
  { key: "travellerDob", label: "TRAVELLER DATE OF BIRTH" },
];

type SourceRow = {
  id: string;
  number: string | null;
  transactionDate: Date | string | null;
  branchSnapshot: unknown;
  partyProfileId: string | null;
  partyProfileSnapshot: unknown;
  agentProfileSnapshot: unknown;
  purposeId: string | null;
  purposeSnapshot: unknown;
  passengerSnapshot: unknown;
  passengerTravelSnapshot: unknown;
  issuerSnapshot: unknown;
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

const textOf = (value: unknown) => {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }
  return "";
};

const snapshotText = (
  snapshot: Record<string, unknown> | null,
  keys: string[],
) => {
  if (!snapshot) {
    return "";
  }
  for (const key of keys) {
    const value = textOf(snapshot[key]);
    if (value) {
      return value;
    }
  }
  return "";
};

const nestedText = (
  snapshot: Record<string, unknown> | null,
  objectKey: string,
  keys: string[],
) => snapshotText(parseSnapshot(snapshot?.[objectKey]), keys);

const displayDate = (value: unknown) => {
  const text = textOf(value);
  if (!text) {
    return "";
  }
  return toDisplayDateOnly(text);
};

const subpurposeCode = (purpose: Record<string, unknown> | null) => {
  const direct = snapshotText(purpose, [
    "subpurposeCode",
    "subPurposeCode",
  ]);
  if (direct) {
    return direct;
  }
  const subpurposes = purpose?.subpurposes;
  if (!Array.isArray(subpurposes) || subpurposes.length !== 1) {
    return "";
  }
  return snapshotText(parseSnapshot(subpurposes[0]), ["code"]);
};

export const loadTourPaxRows = async (
  database2: DataSource,
  filters: {
    startDate: Date;
    endDateExclusive: Date;
    branchIds: string[];
  },
): Promise<SourceRow[]> => {
  const params: unknown[] = [filters.startDate, filters.endDateExclusive];
  const conditions = [
    "tx.deleted_at IS NULL",
    "tx.is_latest = true",
    `tx.status = '${TransactionStatus.APPROVED}'`,
    "tx.transaction_date >= $1",
    "tx.transaction_date < $2",
    "tx.passenger_snapshot IS NOT NULL",
  ];

  if (filters.branchIds.length) {
    const placeholders = filters.branchIds.map((branchId) => {
      params.push(branchId);
      return `$${params.length}`;
    });
    conditions.push(`tx.branch_id IN (${placeholders.join(", ")})`);
  }

  return database2.query(
    `SELECT
        tx.id AS "id",
        tx.number AS "number",
        tx.transaction_date AS "transactionDate",
        tx.branch_snapshot AS "branchSnapshot",
        tx.party_profile_id AS "partyProfileId",
        tx.party_profile_snapshot AS "partyProfileSnapshot",
        tx.agent_profile_snapshot AS "agentProfileSnapshot",
        tx.purpose_id AS "purposeId",
        tx.purpose_snapshot AS "purposeSnapshot",
        tx.passenger_snapshot AS "passengerSnapshot",
        tx.passenger_travel_snapshot AS "passengerTravelSnapshot",
        (
          SELECT item.issuer_party_profile_snapshot
          FROM transaction_items item
          WHERE item.transaction_id = tx.id
            AND item.deleted_at IS NULL
            AND item.issuer_party_profile_snapshot IS NOT NULL
          ORDER BY item.line_no ASC
          LIMIT 1
        ) AS "issuerSnapshot"
      FROM transactions tx
      WHERE ${conditions.join(" AND ")}
      ORDER BY tx.transaction_date ASC, tx.number ASC`,
    params,
  );
};

export const loadTourPaxPurposeCodes = async (
  database: DataSource,
  purposeIds: string[],
) => {
  const uniqueIds = [...new Set(purposeIds.filter(Boolean))];
  if (!uniqueIds.length) {
    return new Map<string, string>();
  }
  const rows = (await database.query(
    `SELECT id, rbi_code AS "rbiCode", code
      FROM purposes
      WHERE deleted_at IS NULL
        AND id = ANY($1::uuid[])`,
    [uniqueIds],
  )) as Array<{ id: string; rbiCode: string | null; code: string | null }>;
  return new Map(
    rows.map((row) => [
      row.id,
      String(row.rbiCode ?? "").trim() || String(row.code ?? "").trim(),
    ]),
  );
};

export const loadTourPaxMarketingReferences = async (
  database: DataSource,
  partyProfileIds: string[],
) => {
  const uniqueIds = [...new Set(partyProfileIds.filter(Boolean))];
  if (!uniqueIds.length) {
    return new Map<string, string>();
  }
  const rows = (await database.query(
    `SELECT
        pp.id AS "id",
        me.code AS "code",
        me.name AS "name"
      FROM party_profiles pp
      LEFT JOIN party_profiles me
        ON me.id = pp.marketing_executive_id
        AND me.deleted_at IS NULL
      WHERE pp.deleted_at IS NULL
        AND pp.id = ANY($1::uuid[])`,
    [uniqueIds],
  )) as Array<{ id: string; code: string | null; name: string | null }>;
  return new Map(
    rows.map((row) => {
      const code = String(row.code ?? "").trim();
      const name = String(row.name ?? "").trim();
      return [row.id, [code, name].filter(Boolean).join(" - ")];
    }),
  );
};

export const buildTourPaxReport = (
  sourceRows: SourceRow[],
  options: {
    startDate: string;
    endDate: string;
    purposeCodeById?: ReadonlyMap<string, string>;
    marketingByPartyId?: ReadonlyMap<string, string>;
  },
): TourPaxReportResponse => {
  const rows: TourPaxRow[] = sourceRows.map((source) => {
    const branch = parseSnapshot(source.branchSnapshot);
    const party = parseSnapshot(source.partyProfileSnapshot);
    const agent = parseSnapshot(source.agentProfileSnapshot);
    const purpose = parseSnapshot(source.purposeSnapshot);
    const passenger = parseSnapshot(source.passengerSnapshot);
    const travel = parseSnapshot(source.passengerTravelSnapshot);
    const issuer = parseSnapshot(source.issuerSnapshot);
    const purposeId = String(source.purposeId ?? "").trim();
    const partyId = String(source.partyProfileId ?? "").trim();
    const snapshotMarketing = [
      nestedText(party, "marketingExecutive", ["code"]),
      nestedText(party, "marketingExecutive", ["name"]),
    ]
      .filter(Boolean)
      .join(" - ");

    return {
      lineKey: source.id,
      branchName: snapshotText(branch, ["name"]) || snapshotText(branch, ["code"]),
      invoiceNo: String(source.number ?? "").trim(),
      invoiceDate: displayDate(source.transactionDate),
      partyCode: snapshotText(party, ["code"]),
      partyName: snapshotText(party, ["name"]),
      agentCode: snapshotText(agent, ["code"]),
      agentName: snapshotText(agent, ["name"]),
      purposeCode:
        options.purposeCodeById?.get(purposeId) ||
        snapshotText(purpose, ["rbiCode", "code"]),
      subpurposeCode: subpurposeCode(purpose),
      issuerCode: snapshotText(issuer, ["code"]),
      marketingReference:
        snapshotMarketing || options.marketingByPartyId?.get(partyId) || "",
      airline:
        nestedText(travel, "airlineTt", ["code", "name", "label"]) ||
        snapshotText(travel, ["airline"]),
      travellingCountry: nestedText(travel, "travellingCountry", [
        "name",
        "code",
      ]),
      dateOfDeparture: displayDate(travel?.departureDate),
      travelPnr: snapshotText(travel, ["travelPnr"]),
      srNo: "1",
      passportNumber: snapshotText(passenger, ["passportNumber"]),
      passportName: snapshotText(passenger, ["passportPassengerName"]),
      placeOfIssue: snapshotText(passenger, ["passportIssueAt"]),
      dateOfIssue: displayDate(passenger?.passportIssueDate),
      dateOfExpiry: displayDate(passenger?.passportExpiryDate),
      panHolderRelation: snapshotText(passenger, ["panHolderRelationType"]),
      travellerPan: snapshotText(passenger, ["panNumber"]),
      panName: snapshotText(passenger, ["panHolderName"]),
      travellerDob: displayDate(passenger?.panDob),
    };
  });

  return {
    startDate: options.startDate,
    endDate: options.endDate,
    message: rows.length ? "" : "No passenger transactions in this date range",
    columns: COLUMNS,
    rows,
  };
};

export const buildTourPaxExport = (
  report: TourPaxReportResponse,
  format: CardSettlementReportFormat,
) => {
  const extension = format === CardSettlementReportFormat.CSV ? "csv" : "xlsx";
  const filename = `tour-pax-report-${report.startDate}-to-${report.endDate}.${extension}`;
  if (format === CardSettlementReportFormat.CSV) {
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
  XLSX.utils.book_append_sheet(workbook, sheet, "Tour Pax");
  return {
    filename,
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer,
  };
};
