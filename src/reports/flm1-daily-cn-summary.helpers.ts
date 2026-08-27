import { BadRequestException } from "@nestjs/common";
import { DataSource } from "typeorm";
import * as XLSX from "xlsx";
import { toUtcDateOnly, toUtcNextDate } from "../common/date/date.util";
import {
  TransactionStatus,
  TransactionType,
  TransactionTypeProfileEnum,
} from "../transactions/transactions.enums";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import { FLM1_DEFAULT_PRODUCT_CODE } from "./flm1-report.constants";
import {
  FlmReportLayout,
  resolveFlmReportLayout,
} from "./flm-report-layout.constants";

export type Flm1LineKind = "HEADER" | "ITEM" | "TOTAL";

export type Flm1ReportColumn = {
  key: string;
  label: string;
  groupLabel?: string;
  highlight?: boolean;
};

export type Flm1ReportRow = Record<string, string> & {
  rowType: Flm1LineKind;
  lineKey: string;
  particulars: string;
};

export type Flm1ReportBlock = {
  columns: Flm1ReportColumn[];
  rows: Flm1ReportRow[];
};

export type Flm1ReportGroup = {
  branchId: string;
  branchLabel: string;
  empty: boolean;
  emptyMessage?: string;
  blocks: Flm1ReportBlock[];
};

export type Flm1ReportResponse = {
  layout: FlmReportLayout;
  date: string;
  productLabel: string;
  currenciesPerBlock: number;
  groups: Flm1ReportGroup[];
};

type MovementBucket =
  | "purchasePublic"
  | "purchaseBulk"
  | "purchaseForeign"
  | "transferIn"
  | "salePublic"
  | "saleBulk"
  | "saleForeign"
  | "transferOut";

type CurrencyTotals = {
  currencyId: string;
  currencyCode: string;
  opening: number;
  purchasePublic: number;
  purchaseBulk: number;
  purchaseForeign: number;
  transferIn: number;
  salePublic: number;
  saleBulk: number;
  saleForeign: number;
  transferOut: number;
  saleGroupQty: Record<string, number>;
  ungroupedSale: number;
};

export type Flm1SaleGroup = {
  id: string;
  title: string;
  purposeIds: string[];
  sortOrder: number;
};

type SourceRow = {
  branchId: string;
  branchSnapshot: Record<string, unknown> | string | null;
  currencyId: string;
  currencySnapshot: Record<string, unknown> | string | null;
  productSnapshot: Record<string, unknown> | string | null;
  slug: string | null;
  transactionType: string | null;
  purposeId: string | null;
  openingQty: string | number | null;
  dayQty: string | number | null;
};

export type Flm1BranchMeta = {
  id: string;
  label: string;
};

type LineDefinition = {
  key: string;
  label: string;
  kind: Flm1LineKind;
  values?: (totals: CurrencyTotals) => number;
};

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
    TransactionTypeProfileEnum.CARD_RETURN,
    TransactionTypeProfileEnum.CARD_VOID,
    "COUNTER_TRANSFER_SELL",
    "COUNTER_TRANSFER_PURCHASE",
  ].map((slug) => slug.toUpperCase()),
);

const SLUG_BUCKET: Record<string, MovementBucket> = {
  [TransactionTypeProfileEnum.PURCHASE_CORPORATE_INDIVIDUAL]: "purchasePublic",
  [TransactionTypeProfileEnum.PURCHASE_FFMC]: "purchaseBulk",
  [TransactionTypeProfileEnum.PURCHASE_RMC]: "purchaseBulk",
  [TransactionTypeProfileEnum.PURCHASE_FOREX]: "purchaseBulk",
  [TransactionTypeProfileEnum.PURCHASE_FRANCHISE]: "purchaseBulk",
  [TransactionTypeProfileEnum.PURCHASE_MISC]: "purchaseBulk",
  [TransactionTypeProfileEnum.PURCHASE_FOREIGN]: "purchaseForeign",
  BRANCH_TRANSFER_PURCHASE: "transferIn",
  [TransactionTypeProfileEnum.SALE_CORPORATE_INDIVIDUAL]: "salePublic",
  [TransactionTypeProfileEnum.SALE_FFMC]: "saleBulk",
  [TransactionTypeProfileEnum.SALE_RMC]: "saleBulk",
  [TransactionTypeProfileEnum.SALE_FOREX]: "saleBulk",
  [TransactionTypeProfileEnum.SALE_FRANCHISE]: "saleBulk",
  [TransactionTypeProfileEnum.SALE_MISC]: "saleBulk",
  [TransactionTypeProfileEnum.SALE_FOREIGN]: "saleForeign",
  BRANCH_TRANSFER_SELL: "transferOut",
};

const LINE_DEFINITIONS: LineDefinition[] = [
  {
    key: "opening",
    label: "I. Opening for that date",
    kind: "ITEM",
    values: (totals) => totals.opening,
  },
  { key: "purchaseHeader", label: "II. Add purchases:", kind: "HEADER" },
  {
    key: "purchasePublic",
    label: "    a. Purchase from public",
    kind: "ITEM",
    values: (totals) => totals.purchasePublic,
  },
  {
    key: "purchaseBulk",
    label: "    b. Purchase from other bulk purchase",
    kind: "ITEM",
    values: (totals) => totals.purchaseBulk,
  },
  {
    key: "purchaseForeign",
    label: "    c. Import from abroad for replenishment of stock",
    kind: "ITEM",
    values: (totals) => totals.purchaseForeign,
  },
  {
    key: "purchaseTotal",
    label: "    Total Purchases: a + b + c",
    kind: "TOTAL",
    values: (totals) =>
      totals.purchasePublic + totals.purchaseBulk + totals.purchaseForeign,
  },
  {
    key: "transferIn",
    label: "III. Stock transfer from branches",
    kind: "ITEM",
    values: (totals) => totals.transferIn,
  },
  {
    key: "inflowTotal",
    label: "Total (I + II + III)",
    kind: "TOTAL",
    values: (totals) =>
      totals.opening +
      totals.purchasePublic +
      totals.purchaseBulk +
      totals.purchaseForeign +
      totals.transferIn,
  },
  { key: "saleHeader", label: "IV. Sale", kind: "HEADER" },
  {
    key: "salePublic",
    label: "    a. Sells to public",
    kind: "ITEM",
    values: (totals) => totals.salePublic,
  },
  {
    key: "saleBulk",
    label: "    b. Sells to authorised dealer / full fledged money changers",
    kind: "ITEM",
    values: (totals) => totals.saleBulk,
  },
  {
    key: "saleForeign",
    label: "    c. Dispatch abroad for realisation",
    kind: "ITEM",
    values: (totals) => totals.saleForeign,
  },
  {
    key: "saleTotal",
    label: "    Total Sells (a + b + c)",
    kind: "TOTAL",
    values: (totals) => totals.salePublic + totals.saleBulk + totals.saleForeign,
  },
  {
    key: "transferOut",
    label: "V. Stock transfer to branches",
    kind: "ITEM",
    values: (totals) => totals.transferOut,
  },
  {
    key: "outflowTotal",
    label: "Total (IV + V)",
    kind: "TOTAL",
    values: (totals) =>
      totals.salePublic +
      totals.saleBulk +
      totals.saleForeign +
      totals.transferOut,
  },
  {
    key: "closing",
    label: "VI. Closing balances (I + II + III - IV - V)",
    kind: "TOTAL",
    values: (totals) =>
      totals.opening +
      totals.purchasePublic +
      totals.purchaseBulk +
      totals.purchaseForeign +
      totals.transferIn -
      totals.salePublic -
      totals.saleBulk -
      totals.saleForeign -
      totals.transferOut,
  },
];

const SALE_BUCKETS = new Set(["salePublic", "saleBulk", "saleForeign"]);

const groupedSaleTotal = (totals: CurrencyTotals) =>
  Object.values(totals.saleGroupQty).reduce((sum, value) => sum + value, 0);

const allSaleTotal = (totals: CurrencyTotals) =>
  groupedSaleTotal(totals) + totals.ungroupedSale;

const resolveSaleGroup = (saleGroups: Flm1SaleGroup[], purposeId: string | null) => {
  if (!purposeId) {
    return null;
  }
  return (
    saleGroups.find((group) => group.purposeIds.includes(purposeId)) ?? null
  );
};

const sortSaleGroups = (saleGroups: Flm1SaleGroup[]) =>
  [...saleGroups].sort(
    (left, right) =>
      (left.sortOrder ?? 0) - (right.sortOrder ?? 0) ||
      left.title.localeCompare(right.title),
  );

const buildLineDefinitions = (saleGroups?: Flm1SaleGroup[]): LineDefinition[] => {
  if (!saleGroups) {
    return LINE_DEFINITIONS;
  }

  const saleItems: LineDefinition[] = sortSaleGroups(saleGroups).map((group) => ({
    key: `saleGroup:${group.id}`,
    label: `    ${group.title}`,
    kind: "ITEM",
    values: (totals) => totals.saleGroupQty[group.id] ?? 0,
  }));

  const saleSection: LineDefinition[] = [
    { key: "saleHeader", label: "IV. Sale", kind: "HEADER" },
    ...saleItems,
    {
      key: "saleTotal",
      label: "    Total Sells",
      kind: "TOTAL",
      values: (totals) => groupedSaleTotal(totals),
    },
    {
      key: "transferOut",
      label: "V. Stock transfer to branches",
      kind: "ITEM",
      values: (totals) => totals.transferOut,
    },
    {
      key: "outflowTotal",
      label: "Total (IV + V)",
      kind: "TOTAL",
      values: (totals) => groupedSaleTotal(totals) + totals.transferOut,
    },
    {
      key: "closing",
      label: "VI. Closing balances (I + II + III - IV - V)",
      kind: "TOTAL",
      values: (totals) =>
        totals.opening +
        totals.purchasePublic +
        totals.purchaseBulk +
        totals.purchaseForeign +
        totals.transferIn -
        allSaleTotal(totals) -
        totals.transferOut,
    },
  ];

  const saleHeaderIndex = LINE_DEFINITIONS.findIndex((line) => line.key === "saleHeader");
  return [...LINE_DEFINITIONS.slice(0, saleHeaderIndex), ...saleSection];
};


const toText = (value: unknown) =>
  value === undefined || value === null ? "" : String(value).trim();

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

const getSnapshotCode = (
  snapshot: Record<string, unknown> | string | null | undefined,
) => {
  const parsed = parseSnapshot(snapshot);
  if (!parsed) {
    return "";
  }
  return (
    toText(parsed.code) ||
    toText(parsed.currencyCode) ||
    toText(parsed.productCode)
  );
};

const getSnapshotLabel = (
  snapshot: Record<string, unknown> | string | null | undefined,
) => {
  const parsed = parseSnapshot(snapshot);
  if (!parsed) {
    return "";
  }
  const code = getSnapshotCode(parsed);
  const name = toText(parsed.name) || toText(parsed.productDescription);
  if (code && name) {
    return `${code} - ${name}`;
  }
  return toText(parsed.label) || name || code;
};

const toNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatQty = (value: number) => {
  if (!Number.isFinite(value) || Math.abs(value) < 1e-12) {
    return "0";
  }
  if (Math.abs(value - Math.round(value)) < 1e-9) {
    return String(Math.round(value));
  }
  return value.toFixed(7).replace(/\.?0+$/, "");
};

const chunkItems = <T>(items: T[], size: number): T[][] => {
  const chunkSize = Math.max(size, 1);
  if (!items.length) {
    return [[]];
  }
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
};

const classifySlug = (
  slug: string | null,
  transactionType: string | null,
): MovementBucket | null => {
  const normalized = toText(slug).toUpperCase();
  if (!normalized || EXCLUDED_SLUGS.has(normalized)) {
    return null;
  }
  const mapped = SLUG_BUCKET[normalized];
  if (mapped) {
    return mapped;
  }
  if (transactionType === TransactionType.PURCHASE) {
    return "purchaseBulk";
  }
  if (transactionType === TransactionType.SALE) {
    return "saleBulk";
  }
  return null;
};

const emptyCurrency = (currencyId: string, currencyCode: string): CurrencyTotals => ({
  currencyId,
  currencyCode,
  opening: 0,
  purchasePublic: 0,
  purchaseBulk: 0,
  purchaseForeign: 0,
  transferIn: 0,
  salePublic: 0,
  saleBulk: 0,
  saleForeign: 0,
  transferOut: 0,
  saleGroupQty: {},
  ungroupedSale: 0,
});

const mergeCurrencyTotals = (
  left: CurrencyTotals,
  right: CurrencyTotals,
): CurrencyTotals => {
  const saleGroupQty = { ...left.saleGroupQty };
  Object.entries(right.saleGroupQty).forEach(([groupId, qty]) => {
    saleGroupQty[groupId] = (saleGroupQty[groupId] ?? 0) + qty;
  });

  return {
    currencyId: left.currencyId,
    currencyCode: left.currencyCode || right.currencyCode,
    opening: left.opening + right.opening,
    purchasePublic: left.purchasePublic + right.purchasePublic,
    purchaseBulk: left.purchaseBulk + right.purchaseBulk,
    purchaseForeign: left.purchaseForeign + right.purchaseForeign,
    transferIn: left.transferIn + right.transferIn,
    salePublic: left.salePublic + right.salePublic,
    saleBulk: left.saleBulk + right.saleBulk,
    saleForeign: left.saleForeign + right.saleForeign,
    transferOut: left.transferOut + right.transferOut,
    saleGroupQty,
    ungroupedSale: left.ungroupedSale + right.ungroupedSale,
  };
};

const consolidateBranchMap = (
  branchMap: Map<
    string,
    { label: string; productLabel: string; currencies: Map<string, CurrencyTotals> }
  >,
) => {
  const consolidated = {
    label: "Consolidated",
    productLabel: "",
    currencies: new Map<string, CurrencyTotals>(),
  };

  branchMap.forEach((branch) => {
    if (branch.productLabel && !consolidated.productLabel) {
      consolidated.productLabel = branch.productLabel;
    }
    branch.currencies.forEach((currency, currencyId) => {
      const current =
        consolidated.currencies.get(currencyId) ??
        emptyCurrency(currencyId, currency.currencyCode);
      consolidated.currencies.set(
        currencyId,
        mergeCurrencyTotals(current, currency),
      );
    });
  });

  return consolidated;
};

const hasMovement = (totals: CurrencyTotals) =>
  [
    totals.opening,
    totals.purchasePublic,
    totals.purchaseBulk,
    totals.purchaseForeign,
    totals.transferIn,
    totals.salePublic,
    totals.saleBulk,
    totals.saleForeign,
    totals.transferOut,
    totals.ungroupedSale,
    ...Object.values(totals.saleGroupQty),
  ].some((value) => Math.abs(value) > 1e-12);

const buildLineRows = (
  currencies: CurrencyTotals[],
  saleGroups?: Flm1SaleGroup[],
): Flm1ReportRow[] =>
  buildLineDefinitions(saleGroups).map((line) => {
    const row: Flm1ReportRow = {
      rowType: line.kind,
      lineKey: line.key,
      particulars: line.label,
    };
    currencies.forEach((currency) => {
      row[currency.currencyId] =
        line.kind === "HEADER" || !line.values ? "" : formatQty(line.values(currency));
    });
    return row;
  });

export const resolveFlm1ReportDate = (date?: string) => {
  if (!date) {
    throw new BadRequestException("Date is required");
  }
  const startDate = toUtcDateOnly(date);
  const endDateExclusive = toUtcNextDate(date);
  if (Number.isNaN(startDate.getTime()) || !endDateExclusive) {
    throw new BadRequestException("Invalid date");
  }
  return { startDate, endDateExclusive, dateLabel: date.slice(0, 10) };
};

export const clampCurrencyColumnCount = (value: number) => {
  if (!Number.isFinite(value)) {
    return 5;
  }
  return Math.min(12, Math.max(1, Math.round(value)));
};

export const loadFlm1SourceRows = async (
  database2: DataSource,
  filters: {
    startDate: Date;
    endDateExclusive: Date;
    branchIds: string[];
    productId?: string;
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
    "tx.slug IS NOT NULL",
    `UPPER(tx.slug) NOT IN (${excludedList})`,
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
        tx.branch_id AS "branchId",
        tx.branch_snapshot AS "branchSnapshot",
        item.currency_id AS "currencyId",
        item.currency_snapshot AS "currencySnapshot",
        item.product_snapshot AS "productSnapshot",
        tx.slug AS "slug",
        tx.transaction_type AS "transactionType",
        tx.purpose_id AS "purposeId",
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
        ) AS "dayQty"
      FROM transaction_items item
      INNER JOIN transactions tx ON tx.id = item.transaction_id
      WHERE ${conditions.join(" AND ")}
      GROUP BY
        tx.branch_id,
        tx.branch_snapshot,
        item.currency_id,
        item.currency_snapshot,
        item.product_snapshot,
        tx.slug,
        tx.transaction_type,
        tx.purpose_id`,
    params,
  );
};

export const buildFlm1DailyCnSummary = (
  sourceRows: SourceRow[],
  options: {
    dateLabel: string;
    currenciesPerBlock: number;
    selectedBranches: Flm1BranchMeta[];
    saleGroups?: Flm1SaleGroup[];
    currencyLabelById?: Record<string, string>;
    layout?: string;
  },
): Flm1ReportResponse => {
  const layout = resolveFlmReportLayout(options.layout);
  const branchMap = new Map<
    string,
    { label: string; productLabel: string; currencies: Map<string, CurrencyTotals> }
  >();

  const ensureBranch = (branchId: string, label: string) => {
    const current = branchMap.get(branchId);
    if (current) {
      return current;
    }
    const created = {
      label,
      productLabel: "",
      currencies: new Map<string, CurrencyTotals>(),
    };
    branchMap.set(branchId, created);
    return created;
  };

  sourceRows.forEach((row) => {
    const branch = ensureBranch(
      row.branchId,
      getSnapshotLabel(row.branchSnapshot) || row.branchId,
    );
    const productLabel = getSnapshotLabel(row.productSnapshot);
    if (productLabel && !branch.productLabel) {
      branch.productLabel = productLabel;
    }
    const currencyCode = getSnapshotCode(row.currencySnapshot) || row.currencyId;
    const currency =
      branch.currencies.get(row.currencyId) ??
      emptyCurrency(row.currencyId, currencyCode);
    currency.opening += toNumber(row.openingQty);
    const bucket = classifySlug(row.slug, row.transactionType);
    if (bucket) {
      const qty = toNumber(row.dayQty);
      if (options.saleGroups && SALE_BUCKETS.has(bucket)) {
        const saleGroup = resolveSaleGroup(options.saleGroups, row.purposeId);
        if (saleGroup) {
          currency.saleGroupQty[saleGroup.id] =
            (currency.saleGroupQty[saleGroup.id] ?? 0) + qty;
        } else {
          currency.ungroupedSale += qty;
        }
      } else {
        currency[bucket] += qty;
      }
    }
    branch.currencies.set(row.currencyId, currency);
  });

  options.selectedBranches.forEach((branch) => {
    const current = ensureBranch(branch.id, branch.label);
    if (!current.label || current.label === branch.id) {
      current.label = branch.label;
    }
  });

  let branchIds = options.selectedBranches.length
    ? options.selectedBranches.map((branch) => branch.id)
    : [...branchMap.keys()].sort((left, right) =>
        (branchMap.get(left)?.label ?? left).localeCompare(
          branchMap.get(right)?.label ?? right,
        ),
      );

  if (layout === FlmReportLayout.CONSOLIDATE) {
    const consolidated = consolidateBranchMap(branchMap);
    branchMap.clear();
    branchMap.set("__consolidated__", consolidated);
    branchIds = ["__consolidated__"];
  }

  let productLabel = FLM1_DEFAULT_PRODUCT_CODE;
  const groups: Flm1ReportGroup[] = branchIds.map((branchId) => {
    const branch =
      branchMap.get(branchId) ??
      ensureBranch(
        branchId,
        options.selectedBranches.find((item) => item.id === branchId)?.label ??
          branchId,
      );
    if (branch.productLabel) {
      productLabel = branch.productLabel;
    }
    const currencies = [...branch.currencies.values()]
      .filter(hasMovement)
      .sort((left, right) => left.currencyCode.localeCompare(right.currencyCode));

    if (!currencies.length) {
      return {
        branchId,
        branchLabel: branch.label,
        empty: true,
        emptyMessage: "No CN stock or movement",
        blocks: [],
      };
    }

    return {
      branchId,
      branchLabel: branch.label,
      empty: false,
      blocks: chunkItems(currencies, options.currenciesPerBlock).map((chunk) => ({
        columns: [
          { key: "particulars", label: "Particulars" },
          ...chunk.map((currency) => ({
            key: currency.currencyId,
            label:
              options.currencyLabelById?.[currency.currencyId] ??
              currency.currencyCode,
          })),
        ],
        rows: buildLineRows(chunk, options.saleGroups),
      })),
    };
  });

  return {
    layout,
    date: options.dateLabel,
    productLabel,
    currenciesPerBlock: options.currenciesPerBlock,
    groups,
  };
};

export const buildFlm1DailyCnSummaryExport = (
  report: Flm1ReportResponse,
  format: CardSettlementReportFormat,
) => {
  const sheetRows: Array<Record<string, string>> = [];

  report.groups.forEach((group) => {
    sheetRows.push({ particulars: group.branchLabel });
    if (group.empty) {
      sheetRows.push({
        particulars: group.emptyMessage || "No CN stock or movement",
      });
      sheetRows.push({});
      return;
    }
    group.blocks.forEach((block) => {
      const header: Record<string, string> = {};
      block.columns.forEach((column) => {
        header[column.key] = column.label;
      });
      sheetRows.push(header);
      block.rows.forEach((row) => {
        const output: Record<string, string> = {};
        block.columns.forEach((column) => {
          output[column.key] = row[column.key] ?? "";
        });
        sheetRows.push(output);
      });
      sheetRows.push({});
    });
  });

  if (format === CardSettlementReportFormat.CSV) {
    const worksheet = XLSX.utils.json_to_sheet(sheetRows);
    return {
      buffer: Buffer.from(XLSX.utils.sheet_to_csv(worksheet), "utf8"),
      contentType: "text/csv; charset=utf-8",
      filename: "flm1-daily-cn-summary.csv",
    };
  }

  const worksheet = XLSX.utils.json_to_sheet(sheetRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "FLM1");
  return {
    buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer,
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: "flm1-daily-cn-summary.xlsx",
  };
};
