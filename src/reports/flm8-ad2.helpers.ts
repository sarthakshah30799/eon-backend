import { BadRequestException } from "@nestjs/common";
import { DataSource } from "typeorm";
import * as XLSX from "xlsx";
import { toUtcDateOnly, toUtcNextDate } from "../common/date/date.util";
import { ClientType } from "../party-profiles/party-profile.entity";
import {
  TransactionStatus,
  TransactionType,
  TransactionTypeProfileEnum,
} from "../transactions/transactions.enums";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import { Flm8Ad2ReportFormat } from "./dto/flm8-ad2-query.dto";
import { FLM1_DEFAULT_PRODUCT_CODE } from "./flm1-report.constants";

export type Flm8Ad2Column = {
  key: string;
  label: string;
};

export type Flm8Ad2Row = Record<string, string> & {
  rowType: "ITEM" | "TOTAL";
  lineKey: string;
};

export type Flm8Ad2Response = {
  reportFormat: Flm8Ad2ReportFormat;
  startDate: string;
  endDate: string;
  apConnect: boolean;
  message: string;
  columns: Flm8Ad2Column[];
  rows: Flm8Ad2Row[];
};

type CurrencyBucket =
  | "purchasePublic"
  | "purchaseFranchise"
  | "purchaseAd"
  | "purchaseFfmc"
  | "imports"
  | "salePublic"
  | "saleFranchise"
  | "saleAd"
  | "saleFfmc"
  | "exports";

type CurrencyCell = {
  currencyId: string;
  code: string;
  name: string;
  opening: number;
  purchasePublic: number;
  purchaseFranchise: number;
  purchaseAd: number;
  purchaseFfmc: number;
  imports: number;
  salePublic: number;
  saleFranchise: number;
  saleAd: number;
  saleFfmc: number;
  exports: number;
};

type SourceRow = {
  currencyId: string;
  currencySnapshot: Record<string, unknown> | string | null;
  slug: string | null;
  transactionType: string | null;
  partyType: string | null;
  purposeLabel: string | null;
  openingQty: string | number | null;
  periodQty: string | number | null;
};

const PARTICULARS_KEY = "particulars";

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
  ].map((slug) => slug.toUpperCase()),
);

const PUBLIC_TYPES = new Set(["INDIVIDUAL", "CORPORATE", "CORPORATE_CLIENT"]);
const FRANCHISE_TYPES = new Set([
  "FRANCHISE",
  "FOREX",
  "FOREX_CORRESPONDENT",
  "FOREIGN_CORRESPONDENT",
]);

const PARTY_TYPE_CODES: Record<string, string> = {
  [ClientType.FRANCHISE]: "FR",
  [ClientType.FFMC]: "FFMC",
  [ClientType.AUTHORISED_DEALER]: "AD",
  [ClientType.RMC]: "RMC",
  [ClientType.RF]: "RF",
  [ClientType.FOREX_CORRESPONDENT]: "FXC",
  [ClientType.FOREIGN_CORRESPONDENT]: "FC",
  [ClientType.CORPORATE_CLIENT]: "CC",
  [ClientType.AGENT]: "AG",
  [ClientType.MARKETING_EXECUTIVE]: "ME",
  [ClientType.CARD_ISSUER_PROFILE]: "CI",
  [ClientType.MISC_PROFILE]: "MS",
  [ClientType.EMPLOYEE_PROFILE]: "EM",
};

const purchaseTotal = (cell: CurrencyCell) =>
  cell.purchasePublic +
  cell.purchaseFranchise +
  cell.purchaseAd +
  cell.purchaseFfmc;

const saleTotal = (cell: CurrencyCell) =>
  cell.salePublic + cell.saleFranchise + cell.saleAd + cell.saleFfmc;

const CURRENCY_LINES: Array<{
  key: string;
  line: string;
  label: string;
  rowType: "ITEM" | "TOTAL";
  value: (cell: CurrencyCell) => number;
}> = [
  {
    key: "opening",
    line: "A",
    label: "Opening Balance",
    rowType: "TOTAL",
    value: (cell) => cell.opening,
  },
  {
    key: "purchases",
    line: "B",
    label: "Purchases",
    rowType: "TOTAL",
    value: purchaseTotal,
  },
  {
    key: "purchasePublic",
    line: "B.1",
    label: "Purchase From Public",
    rowType: "ITEM",
    value: (cell) => cell.purchasePublic,
  },
  {
    key: "purchaseFranchise",
    line: "B.2",
    label: "Purchase Through Franchises / FxCs*",
    rowType: "ITEM",
    value: (cell) => cell.purchaseFranchise,
  },
  {
    key: "purchaseAd",
    line: "B.3",
    label: "Purchases from AD Banks",
    rowType: "ITEM",
    value: (cell) => cell.purchaseAd,
  },
  {
    key: "purchaseFfmc",
    line: "B.4",
    label: "Purchases from Other FFMCs / Non-bank ADs",
    rowType: "ITEM",
    value: (cell) => cell.purchaseFfmc,
  },
  {
    key: "imports",
    line: "B.5",
    label: "Imports",
    rowType: "ITEM",
    value: () => 0,
  },
  {
    key: "sales",
    line: "C",
    label: "Sales",
    rowType: "TOTAL",
    value: saleTotal,
  },
  {
    key: "salePublic",
    line: "C.1",
    label: "Sales To Public",
    rowType: "ITEM",
    value: (cell) => cell.salePublic,
  },
  {
    key: "saleFranchise",
    line: "C.2",
    label: "Sales Through FxCs*",
    rowType: "ITEM",
    value: (cell) => cell.saleFranchise,
  },
  {
    key: "saleAd",
    line: "C.3",
    label: "Sales to AD Banks",
    rowType: "ITEM",
    value: (cell) => cell.saleAd,
  },
  {
    key: "saleFfmc",
    line: "C.4",
    label: "Sales to Other FFMCs / Non Bank ADs",
    rowType: "ITEM",
    value: (cell) => cell.saleFfmc,
  },
  {
    key: "exports",
    line: "C.5",
    label: "Exports",
    rowType: "ITEM",
    value: () => 0,
  },
  {
    key: "writtenOff",
    line: "D",
    label: "Foreign Currency Notes Written-Off",
    rowType: "ITEM",
    value: () => 0,
  },
  {
    key: "closing",
    line: "E",
    label: "Closing Balance",
    rowType: "TOTAL",
    value: (cell) => cell.opening + purchaseTotal(cell) - saleTotal(cell),
  },
];

const PARTY_COLUMNS: Flm8Ad2Column[] = [
  { key: "partyType", label: "PARTYTYPE" },
  { key: "partyName", label: "PARTYNAME" },
  { key: "address", label: "ADDRESS" },
  { key: "city", label: "CITY" },
  { key: "state", label: "STATE" },
  { key: "pinCode", label: "PINCODE" },
  { key: "appointmentDate", label: "APPOINTMENTDATE" },
  { key: "fxFacility", label: "FXFACILITY" },
];

export const PURPOSE_DETAILS_MESSAGE =
  "No purpose movement in this date range";

export const resolveFlm8Ad2DateRange = (startDate: string, endDate: string) => {
  const start = toUtcDateOnly(startDate);
  const endExclusive = toUtcNextDate(endDate);
  if (Number.isNaN(start.getTime()) || !endExclusive) {
    throw new BadRequestException("Invalid date range");
  }
  if (start.getTime() >= endExclusive.getTime()) {
    throw new BadRequestException("Start date cannot be after end date");
  }
  return { startDate: start, endDateExclusive: endExclusive };
};

const resolveFormat = (value?: string): Flm8Ad2ReportFormat => {
  if (value === Flm8Ad2ReportFormat.PURPOSE) {
    return Flm8Ad2ReportFormat.PURPOSE;
  }
  if (value === Flm8Ad2ReportFormat.PARTY) {
    return Flm8Ad2ReportFormat.PARTY;
  }
  return Flm8Ad2ReportFormat.CURRENCY;
};

const toNumber = (value: string | number | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatQty = (value: number) => value.toFixed(4);

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
  }
  return "";
};

const emptyCell = (currencyId: string, code: string, name: string): CurrencyCell => ({
  currencyId,
  code,
  name,
  opening: 0,
  purchasePublic: 0,
  purchaseFranchise: 0,
  purchaseAd: 0,
  purchaseFfmc: 0,
  imports: 0,
  salePublic: 0,
  saleFranchise: 0,
  saleAd: 0,
  saleFfmc: 0,
  exports: 0,
});

const isAdBankPurpose = (purposeLabel: string) => {
  const normalized = purposeLabel.replace(/[^A-Z0-9]/g, "");
  return normalized === "ADBANK" || normalized === "ADBANKS";
};

const purchaseBucket = (
  slug: string,
  partyType: string,
  purposeLabel: string,
): CurrencyBucket => {
  if (
    slug === TransactionTypeProfileEnum.PURCHASE_CORPORATE_INDIVIDUAL ||
    PUBLIC_TYPES.has(partyType)
  ) {
    return "purchasePublic";
  }
  if (
    slug === TransactionTypeProfileEnum.PURCHASE_FRANCHISE ||
    slug === TransactionTypeProfileEnum.PURCHASE_FOREX ||
    FRANCHISE_TYPES.has(partyType)
  ) {
    return "purchaseFranchise";
  }
  if (isAdBankPurpose(purposeLabel)) {
    return "purchaseAd";
  }
  return "purchaseFfmc";
};

const saleBucket = (
  slug: string,
  partyType: string,
  purposeLabel: string,
): CurrencyBucket => {
  if (
    slug === TransactionTypeProfileEnum.SALE_CORPORATE_INDIVIDUAL ||
    PUBLIC_TYPES.has(partyType)
  ) {
    return "salePublic";
  }
  if (
    slug === TransactionTypeProfileEnum.SALE_FRANCHISE ||
    slug === TransactionTypeProfileEnum.SALE_FOREX ||
    FRANCHISE_TYPES.has(partyType)
  ) {
    return "saleFranchise";
  }
  if (isAdBankPurpose(purposeLabel)) {
    return "saleAd";
  }
  return "saleFfmc";
};

const formatAppointmentDate = (value: Date | string | null) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const day = date.getUTCDate();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  const meridiem = date.getUTCHours() >= 12 ? "PM" : "AM";
  const hour12 = date.getUTCHours() % 12 || 12;
  return `${day}/${month}/${year} ${hour12}:${minutes}:${seconds} ${meridiem}`;
};

const partyTypeCode = (value: string | null) => {
  const normalized = String(value ?? "").trim().toUpperCase();
  return PARTY_TYPE_CODES[normalized] || normalized;
};

export const loadFlm8Ad2CurrencyRows = async (
  database2: DataSource,
  filters: {
    startDate: Date;
    endDateExclusive: Date;
    branchIds: string[];
  },
): Promise<SourceRow[]> => {
  const params: unknown[] = [filters.startDate, filters.endDateExclusive];
  const excludedList = [...EXCLUDED_SLUGS]
    .map((slug) => `'${slug.replace(/'/g, "''")}'`)
    .join(", ");
  const conditions = [
    "tx.deleted_at IS NULL",
    "item.deleted_at IS NULL",
    "tx.is_latest = true",
    `tx.status = '${TransactionStatus.APPROVED}'`,
    "item.card_id IS NULL",
    "item.deal_cover_id IS NULL",
    "tx.slug IS NOT NULL",
    `UPPER(tx.slug) NOT IN (${excludedList})`,
    `UPPER(COALESCE(item.product_snapshot->>'code', item.product_snapshot->>'productCode', '')) = '${FLM1_DEFAULT_PRODUCT_CODE}'`,
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
        item.currency_id AS "currencyId",
        item.currency_snapshot AS "currencySnapshot",
        UPPER(tx.slug) AS "slug",
        tx.transaction_type AS "transactionType",
        UPPER(COALESCE(
          tx.party_profile_snapshot->>'type',
          tx.transaction_party_profile_type::text,
          ''
        )) AS "partyType",
        UPPER(BTRIM(COALESCE(
          tx.purpose_snapshot->>'description',
          tx.purpose_snapshot->>'name',
          ''
        ))) AS "purposeLabel",
        SUM(
          CASE
            WHEN tx.transaction_date < $1 THEN
              CASE
                WHEN tx.transaction_type = '${TransactionType.PURCHASE}' THEN item.quantity::numeric
                ELSE -item.quantity::numeric
              END
            ELSE 0
          END
        ) AS "openingQty",
        SUM(
          CASE
            WHEN tx.transaction_date >= $1 AND tx.transaction_date < $2 THEN item.quantity::numeric
            ELSE 0
          END
        ) AS "periodQty"
      FROM transaction_items item
      INNER JOIN transactions tx ON tx.id = item.transaction_id
      WHERE ${conditions.join(" AND ")}
      GROUP BY
        item.currency_id,
        item.currency_snapshot,
        UPPER(tx.slug),
        tx.transaction_type,
        UPPER(COALESCE(
          tx.party_profile_snapshot->>'type',
          tx.transaction_party_profile_type::text,
          ''
        )),
        UPPER(BTRIM(COALESCE(
          tx.purpose_snapshot->>'description',
          tx.purpose_snapshot->>'name',
          ''
        )))`,
    params,
  );
};

export const buildFlm8Ad2CurrencyReport = (
  sourceRows: SourceRow[],
  options: {
    startDate: string;
    endDate: string;
    apConnect: boolean;
    currencyLabelById?: Record<string, string>;
    currencies?: Flm8Ad2CurrencyCatalogItem[];
  },
): Flm8Ad2Response => {
  const cells = new Map<string, CurrencyCell>();
  (options.currencies ?? []).forEach((currency) => {
    cells.set(
      currency.id,
      emptyCell(currency.id, currency.code, currency.name || currency.code),
    );
  });

  sourceRows.forEach((row) => {
    const snapshot = parseSnapshot(row.currencySnapshot);
    const code =
      snapshotText(snapshot, ["code", "currencyCode"]) || row.currencyId;
    const name =
      snapshotText(snapshot, ["currencyName", "name"]) || code;
    const cell =
      cells.get(row.currencyId) ?? emptyCell(row.currencyId, code, name);
    if (!cell.code) {
      cell.code = code;
    }
    if (!cell.name) {
      cell.name = name;
    }
    cell.opening += toNumber(row.openingQty);
    const periodQty = toNumber(row.periodQty);
    const slug = String(row.slug ?? "").toUpperCase();
    const partyType = String(row.partyType ?? "").toUpperCase();
    const purposeLabel = String(row.purposeLabel ?? "").toUpperCase();
    const transactionType = String(row.transactionType ?? "").toUpperCase();
    if (
      slug === "BRANCH_TRANSFER_PURCHASE" ||
      slug === "BRANCH_TRANSFER_SELL"
    ) {
      cells.set(row.currencyId, cell);
      return;
    }
    if (periodQty && transactionType === TransactionType.PURCHASE) {
      cell[purchaseBucket(slug, partyType, purposeLabel)] += periodQty;
    }
    if (periodQty && transactionType === TransactionType.SALE) {
      cell[saleBucket(slug, partyType, purposeLabel)] += periodQty;
    }
    cells.set(row.currencyId, cell);
  });

  const currencies = [...cells.values()].sort((left, right) =>
    left.code.localeCompare(right.code),
  );

  const columns: Flm8Ad2Column[] = [
    { key: "line", label: "" },
    { key: PARTICULARS_KEY, label: "" },
    ...currencies.map((cell) => ({
      key: cell.currencyId,
      label: options.apConnect
        ? options.currencyLabelById?.[cell.currencyId] || cell.name || cell.code
        : cell.code,
    })),
  ];

  const rows: Flm8Ad2Row[] = CURRENCY_LINES.map((line) => {
    const row: Flm8Ad2Row = {
      rowType: line.rowType,
      lineKey: line.key,
      line: line.line,
      particulars: line.label,
    };
    currencies.forEach((cell) => {
      row[cell.currencyId] = formatQty(line.value(cell));
    });
    return row;
  });

  return {
    reportFormat: Flm8Ad2ReportFormat.CURRENCY,
    startDate: options.startDate,
    endDate: options.endDate,
    apConnect: options.apConnect,
    message: currencies.length ? "" : "No currencies available",
    columns,
    rows,
  };
};

type PartySourceRow = {
  partyType: string | null;
  code: string | null;
  name: string | null;
  address1: string | null;
  address2: string | null;
  address3: string | null;
  city: string | null;
  stateCode: string | null;
  pinCode: string | null;
  appointmentDate: Date | string | null;
  sale: boolean | null;
  purchase: boolean | null;
};

export const loadFlm8Ad2PartyRows = async (
  database: DataSource,
  filters: {
    startDate: Date;
    endDateExclusive: Date;
    branchIds: string[];
  },
): Promise<PartySourceRow[]> => {
  const params: unknown[] = [filters.startDate, filters.endDateExclusive];
  const conditions = [
    "pp.deleted_at IS NULL",
    "pp.date_of_intro >= $1",
    "pp.date_of_intro < $2",
  ];

  if (filters.branchIds.length) {
    const placeholders = filters.branchIds.map((branchId) => {
      params.push(branchId);
      return `$${params.length}`;
    });
    conditions.push(
      `EXISTS (
        SELECT 1
        FROM party_profile_branches link
        WHERE link.party_profile_id = pp.id
          AND link.deleted_at IS NULL
          AND link.branch_id IN (${placeholders.join(", ")})
      )`,
    );
  }

  return database.query(
    `SELECT
        pp.type AS "partyType",
        pp.code AS "code",
        pp.name AS "name",
        pp.address1 AS "address1",
        pp.address2 AS "address2",
        pp.address3 AS "address3",
        pp.city AS "city",
        COALESCE(NULLIF(BTRIM(st.gst_state_code), ''), NULLIF(BTRIM(st.code), ''), '') AS "stateCode",
        pp.pin_code AS "pinCode",
        pp.date_of_intro AS "appointmentDate",
        pp.sale AS "sale",
        pp.purchase AS "purchase"
      FROM party_profiles pp
      LEFT JOIN states st ON st.id = pp.state_id AND st.deleted_at IS NULL
      WHERE ${conditions.join(" AND ")}
      ORDER BY pp.date_of_intro ASC, pp.name ASC, pp.code ASC`,
    params,
  );
};

export const buildFlm8Ad2PartyReport = (
  sourceRows: PartySourceRow[],
  options: { startDate: string; endDate: string; apConnect: boolean },
): Flm8Ad2Response => ({
  reportFormat: Flm8Ad2ReportFormat.PARTY,
  startDate: options.startDate,
  endDate: options.endDate,
  apConnect: options.apConnect,
  message: sourceRows.length ? "" : "No parties onboarded in this date range",
  columns: PARTY_COLUMNS,
  rows: sourceRows.map((row) => {
    const name = String(row.name ?? "").trim();
    const code = String(row.code ?? "").trim();
    const partyName = [name, code ? `(${code})` : ""]
      .filter(Boolean)
      .join(" ")
      .toUpperCase();
    const address = [row.address1, row.address2, row.address3]
      .map((part) => String(part ?? "").trim())
      .filter(Boolean)
      .join(",")
      .toUpperCase();

    return {
      rowType: "ITEM" as const,
      lineKey: code || partyName,
      particulars: partyName,
      partyType: partyTypeCode(row.partyType),
      partyName,
      address,
      city: String(row.city ?? "").trim().toUpperCase(),
      state: String(row.stateCode ?? "").trim(),
      pinCode: String(row.pinCode ?? "").trim(),
      appointmentDate: formatAppointmentDate(row.appointmentDate),
      fxFacility: row.sale || row.purchase ? "Yes" : "No",
    };
  }),
});

type PurposeSourceRow = {
  purposeId: string | null;
  purposeSnapshot: Record<string, unknown> | string | null;
  transactionType: string | null;
  currencyId: string;
  currencySnapshot: Record<string, unknown> | string | null;
  periodQty: string | number | null;
  inrAmount: string | number | null;
};

export type Flm8Ad2PurposeMeta = {
  id: string;
  rbiCode: string | null;
  code: string | null;
  description: string | null;
};

export type Flm8Ad2CurrencyCatalogItem = {
  id: string;
  code: string;
  name: string;
};

export const loadFlm8Ad2CurrencyCatalog = async (
  database: DataSource,
): Promise<Flm8Ad2CurrencyCatalogItem[]> =>
  database.query(
    `SELECT
        id,
        currency_code AS "code",
        currency_name AS "name"
      FROM currencies
      WHERE deleted_at IS NULL
        AND active = true
      ORDER BY currency_code ASC`,
  );

export const loadFlm8Ad2PurposeRows = async (
  database2: DataSource,
  filters: {
    startDate: Date;
    endDateExclusive: Date;
    branchIds: string[];
  },
): Promise<PurposeSourceRow[]> => {
  const params: unknown[] = [filters.startDate, filters.endDateExclusive];
  const excludedList = [...EXCLUDED_SLUGS]
    .map((slug) => `'${slug.replace(/'/g, "''")}'`)
    .join(", ");
  const conditions = [
    "tx.deleted_at IS NULL",
    "item.deleted_at IS NULL",
    "tx.is_latest = true",
    `tx.status = '${TransactionStatus.APPROVED}'`,
    "item.card_id IS NULL",
    "item.deal_cover_id IS NULL",
    "tx.slug IS NOT NULL",
    `UPPER(tx.slug) NOT IN (${excludedList})`,
    `UPPER(COALESCE(item.product_snapshot->>'code', item.product_snapshot->>'productCode', '')) = '${FLM1_DEFAULT_PRODUCT_CODE}'`,
    "tx.transaction_date >= $1",
    "tx.transaction_date < $2",
    "tx.purpose_id IS NOT NULL",
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
        tx.purpose_id AS "purposeId",
        tx.purpose_snapshot AS "purposeSnapshot",
        tx.transaction_type AS "transactionType",
        item.currency_id AS "currencyId",
        item.currency_snapshot AS "currencySnapshot",
        SUM(item.quantity::numeric) AS "periodQty",
        SUM(COALESCE(item.amount, 0)::numeric) AS "inrAmount"
      FROM transaction_items item
      INNER JOIN transactions tx ON tx.id = item.transaction_id
      WHERE ${conditions.join(" AND ")}
      GROUP BY
        tx.purpose_id,
        tx.purpose_snapshot,
        tx.transaction_type,
        item.currency_id,
        item.currency_snapshot`,
    params,
  );
};

export const loadFlm8Ad2PurposeMeta = async (
  database: DataSource,
): Promise<Flm8Ad2PurposeMeta[]> =>
  database.query(
    `SELECT
        id,
        rbi_code AS "rbiCode",
        code,
        description
      FROM purposes
      WHERE deleted_at IS NULL
      ORDER BY
        COALESCE(NULLIF(BTRIM(rbi_code), ''), code) ASC,
        description ASC`,
  );

const formatMoney = (value: number) => value.toFixed(2);

const purposeIdentity = (
  purposeId: string,
  snapshot: Record<string, unknown> | null,
  meta: Flm8Ad2PurposeMeta | undefined,
) => {
  const purposeCode =
    String(meta?.code ?? "").trim() || snapshotText(snapshot, ["code"]);
  const description =
    String(meta?.description ?? "").trim() ||
    snapshotText(snapshot, ["description"]);
  const rbiCode =
    String(meta?.rbiCode ?? "").trim() || snapshotText(snapshot, ["rbiCode"]);
  return { purposeId, purposeCode, description, rbiCode };
};

const trxTypeCode = (transactionType: string) =>
  transactionType === TransactionType.PURCHASE ? "PB" : "PS";

export const buildFlm8Ad2PurposeReport = (
  sourceRows: PurposeSourceRow[],
  purposeMeta: Flm8Ad2PurposeMeta[],
  options: {
    startDate: string;
    endDate: string;
    apConnect: boolean;
    currencyLabelById?: Record<string, string>;
    currencies?: Flm8Ad2CurrencyCatalogItem[];
  },
): Flm8Ad2Response => {
  const metaById = new Map(purposeMeta.map((purpose) => [purpose.id, purpose]));
  const currencyById = new Map<string, { code: string; name: string }>();
  (options.currencies ?? []).forEach((currency) => {
    currencyById.set(currency.id, {
      code: currency.code,
      name: currency.name || currency.code,
    });
  });

  if (!options.apConnect) {
    const groups = new Map<
      string,
      {
        currencyCode: string;
        trxType: string;
        purposeCode: string;
        purposeDesc: string;
        rbiCode: string;
        fxAmount: number;
        inrAmount: number;
      }
    >();
    sourceRows.forEach((row) => {
      const purposeId = String(row.purposeId ?? "").trim();
      const currencyId = String(row.currencyId ?? "").trim();
      if (!purposeId || !currencyId) {
        return;
      }
      const fxAmount = toNumber(row.periodQty);
      const inrAmount = toNumber(row.inrAmount);
      if (!fxAmount && !inrAmount) {
        return;
      }
      const snapshot = parseSnapshot(row.purposeSnapshot);
      const identity = purposeIdentity(purposeId, snapshot, metaById.get(purposeId));
      const currencySnapshot = parseSnapshot(row.currencySnapshot);
      const known = currencyById.get(currencyId);
      const currencyCode = (
        known?.code ||
        snapshotText(currencySnapshot, ["code", "currencyCode"]) ||
        currencyId
      ).toUpperCase();
      const transactionType = String(row.transactionType ?? "").toUpperCase();
      const trxType = trxTypeCode(transactionType);
      const key = [currencyCode, trxType, purposeId].join("|");
      const current = groups.get(key) ?? {
        currencyCode,
        trxType,
        purposeCode: identity.purposeCode.toUpperCase(),
        purposeDesc: identity.description.toUpperCase(),
        rbiCode: identity.rbiCode.toUpperCase(),
        fxAmount: 0,
        inrAmount: 0,
      };
      current.fxAmount += fxAmount;
      current.inrAmount += inrAmount;
      groups.set(key, current);
    });
    const rows = [...groups.values()].sort((left, right) => {
      const currencyCompare = left.currencyCode.localeCompare(right.currencyCode);
      if (currencyCompare !== 0) {
        return currencyCompare;
      }
      const typeCompare = left.trxType.localeCompare(right.trxType);
      if (typeCompare !== 0) {
        return typeCompare;
      }
      const purposeCompare = left.purposeCode.localeCompare(right.purposeCode);
      if (purposeCompare !== 0) {
        return purposeCompare;
      }
      return left.rbiCode.localeCompare(right.rbiCode);
    });
    return {
      reportFormat: Flm8Ad2ReportFormat.PURPOSE,
      startDate: options.startDate,
      endDate: options.endDate,
      apConnect: false,
      message: rows.length ? "" : PURPOSE_DETAILS_MESSAGE,
      columns: [
        { key: "trCurr", label: "TRCURR" },
        { key: "trxType", label: "TRXTYPE" },
        { key: "purposeCode", label: "PURPOSECODE" },
        { key: "purposeDesc", label: "PURPOSEDESC" },
        { key: "rbiCode", label: "RBICODE" },
        { key: "fxAmount", label: "FXAMOUNT" },
        { key: "amount", label: "AMOUNT" },
      ],
      rows: rows.map((row) => ({
        rowType: "ITEM" as const,
        lineKey: [row.currencyCode, row.trxType, row.purposeCode, row.rbiCode].join("|"),
        particulars: row.purposeDesc,
        trCurr: row.currencyCode,
        trxType: row.trxType,
        purposeCode: row.purposeCode,
        purposeDesc: row.purposeDesc,
        rbiCode: row.rbiCode,
        fxAmount: formatMoney(row.fxAmount),
        amount: formatMoney(row.inrAmount),
      })),
    };
  }

  const purposes = new Map<
    string,
    {
      rbiCode: string;
      description: string;
      amounts: Map<string, number>;
    }
  >();
  sourceRows.forEach((row) => {
    const purposeId = String(row.purposeId ?? "").trim();
    const currencyId = String(row.currencyId ?? "").trim();
    const quantity = toNumber(row.periodQty);
    if (!purposeId || !currencyId || !quantity) {
      return;
    }
    const snapshot = parseSnapshot(row.purposeSnapshot);
    const identity = purposeIdentity(purposeId, snapshot, metaById.get(purposeId));
    const current = purposes.get(purposeId) ?? {
      rbiCode: identity.rbiCode || identity.purposeCode,
      description: identity.description,
      amounts: new Map<string, number>(),
    };
    current.amounts.set(currencyId, (current.amounts.get(currencyId) ?? 0) + quantity);
    purposes.set(purposeId, current);

    const currencySnapshot = parseSnapshot(row.currencySnapshot);
    if (!currencyById.has(currencyId)) {
      currencyById.set(currencyId, {
        code:
          snapshotText(currencySnapshot, ["code", "currencyCode"]) || currencyId,
        name:
          snapshotText(currencySnapshot, ["currencyName", "name"]) ||
          snapshotText(currencySnapshot, ["code", "currencyCode"]) ||
          currencyId,
      });
    }
  });

  const usedCurrencyIds = new Set<string>();
  purposes.forEach((purpose) => {
    purpose.amounts.forEach((_amount, currencyId) => {
      usedCurrencyIds.add(currencyId);
    });
  });
  const currencyColumns = [...usedCurrencyIds]
    .map((currencyId) => ({
      currencyId,
      ...(currencyById.get(currencyId) ?? { code: currencyId, name: currencyId }),
    }))
    .sort((left, right) =>
      (left.name || left.code).localeCompare(right.name || right.code),
    );
  const purposeRows = [...purposes.entries()].sort((left, right) => {
    const codeCompare = left[1].rbiCode.localeCompare(right[1].rbiCode);
    if (codeCompare !== 0) {
      return codeCompare;
    }
    return left[1].description.localeCompare(right[1].description);
  });

  return {
    reportFormat: Flm8Ad2ReportFormat.PURPOSE,
    startDate: options.startDate,
    endDate: options.endDate,
    apConnect: true,
    message: purposeRows.length ? "" : PURPOSE_DETAILS_MESSAGE,
    columns: [
      { key: "srNo", label: "Sr No" },
      { key: "purposeCode", label: "Purpose Codes" },
      { key: "purposeDescription", label: "Purpose Description" },
      ...currencyColumns.map((currency) => ({
        key: currency.currencyId,
        label:
          currency.name ||
          options.currencyLabelById?.[currency.currencyId] ||
          currency.code,
      })),
    ],
    rows: purposeRows.map(([purposeId, purpose], index) => {
      const row: Flm8Ad2Row = {
        rowType: "ITEM",
        lineKey: purposeId,
        particulars: purpose.description || purpose.rbiCode,
        srNo: String(index + 1),
        purposeCode: purpose.rbiCode,
        purposeDescription: purpose.description,
      };
      currencyColumns.forEach((currency) => {
        const amount = purpose.amounts.get(currency.currencyId) ?? 0;
        row[currency.currencyId] = amount ? formatQty(amount) : "";
      });
      return row;
    }),
  };
};

export const buildFlm8Ad2ReportShell = (
  reportFormat: string | undefined,
  options: { startDate: string; endDate: string; apConnect: boolean },
): Flm8Ad2Response | null => {
  const format = resolveFormat(reportFormat);
  if (format === Flm8Ad2ReportFormat.PURPOSE) {
    return buildFlm8Ad2PurposeReport([], [], options);
  }
  return null;
};

const worksheetFromReport = (report: Flm8Ad2Response) => {
  const header = report.columns.map((column) => column.label);
  const body = report.rows.map((row) =>
    report.columns.map((column) => row[column.key] ?? ""),
  );
  const sheet = XLSX.utils.aoa_to_sheet(
    report.message && !report.rows.length
      ? [[report.message]]
      : [header, ...body],
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "FLM 8 AD 2");
  return workbook;
};

export const buildFlm8Ad2Export = (
  report: Flm8Ad2Response,
  format: CardSettlementReportFormat,
) => {
  const extension =
    format === CardSettlementReportFormat.CSV ? "csv" : "xlsx";
  const filename = `flm8-ad2-${report.reportFormat}-${report.startDate}-to-${report.endDate}.${extension}`;
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
    const csv = report.message && !report.rows.length
      ? report.message
      : [header, ...lines].join("\n");
    return {
      filename,
      contentType: "text/csv; charset=utf-8",
      buffer: Buffer.from(csv, "utf8"),
    };
  }

  return {
    filename,
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: XLSX.write(worksheetFromReport(report), {
      type: "buffer",
      bookType: "xlsx",
    }) as Buffer,
  };
};
