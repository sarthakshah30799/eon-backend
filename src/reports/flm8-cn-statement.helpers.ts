import * as XLSX from "xlsx";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import { Flm8CnStatementView } from "./dto/flm8-cn-statement-query.dto";
import {
  buildFlm1DailyCnSummary,
  buildFlm1DailyCnSummaryExport,
  loadFlm1SourceRows,
  type Flm1BranchMeta,
  type Flm1SaleGroup,
  type Flm1ReportColumn,
  type Flm1ReportGroup,
  type Flm1ReportResponse,
  type Flm1ReportRow,
} from "./flm1-daily-cn-summary.helpers";
import { resolveFlm3DateRange } from "./flm3-purchase-from-public.helpers";

export const resolveFlm8DateRange = resolveFlm3DateRange;
export const loadFlm8SourceRows = loadFlm1SourceRows;

export type Flm8CnStatementResponse = Flm1ReportResponse & {
  view: Flm8CnStatementView;
  startDate: string;
  endDate: string;
};

const PARTICULARS_KEY = "particulars";
const SALE_GROUP_PREFIX = "saleGroup:";
const PURCHASE_LINE_KEYS = [
  "purchasePublic",
  "purchaseBulk",
  "purchaseForeign",
] as const;

const HORIZONTAL_HEADER = {
  currency: "Currency Code",
  opening: "Opening Balances",
  purchaseGroup: "Purchases of foreign currency notes from",
  saleGroup: "Sales of foreign currency notes under (with purpose codes)",
  purchaseTotal: "B. Total Purchases (a) + (b) + (c)",
  saleTotal: "C. Total Sales",
} as const;

const resolveView = (view?: string): Flm8CnStatementView =>
  view === Flm8CnStatementView.HORIZONTAL
    ? Flm8CnStatementView.HORIZONTAL
    : Flm8CnStatementView.VERTICAL;

const toLetter = (index: number) => `(${String.fromCharCode(97 + index)})`;

const joinLetters = (count: number) =>
  Array.from({ length: count }, (_, index) => toLetter(index)).join(" + ");

const stripLeadingLetter = (label: string) =>
  label.replace(/^[a-z]\.\s*/i, "").trim();

const toHorizontalColumns = (templateRows: Flm1ReportRow[]): Flm1ReportColumn[] => {
  const saleGroupRows = templateRows.filter((row) =>
    row.lineKey.startsWith(SALE_GROUP_PREFIX),
  );
  const saleLetterByKey = new Map(
    saleGroupRows.map((row, index) => [row.lineKey, toLetter(index)]),
  );
  const saleLetters = joinLetters(saleGroupRows.length);

  return [
    { key: PARTICULARS_KEY, label: HORIZONTAL_HEADER.currency },
    ...templateRows.map((row) => {
      const key = row.lineKey;
      const trimmed = row.particulars.trim();
      const purchaseIndex = (PURCHASE_LINE_KEYS as readonly string[]).indexOf(key);

      if (key === "opening") {
        return { key, label: HORIZONTAL_HEADER.opening };
      }

      if (purchaseIndex >= 0) {
        return {
          key,
          label: `${toLetter(purchaseIndex)} ${stripLeadingLetter(trimmed)}`,
          groupLabel: HORIZONTAL_HEADER.purchaseGroup,
        };
      }

      if (key === "purchaseTotal") {
        return {
          key,
          label: HORIZONTAL_HEADER.purchaseTotal,
          highlight: true,
        };
      }

      if (key.startsWith(SALE_GROUP_PREFIX)) {
        return {
          key,
          label: `${saleLetterByKey.get(key) ?? ""} ${trimmed}`.trim(),
          groupLabel: HORIZONTAL_HEADER.saleGroup,
        };
      }

      if (key === "saleTotal") {
        return {
          key,
          label: saleGroupRows.length
            ? `${HORIZONTAL_HEADER.saleTotal} ${saleLetters}`
            : HORIZONTAL_HEADER.saleTotal,
          highlight: true,
        };
      }

      if (key === "closing") {
        return { key, label: trimmed, highlight: true };
      }

      return { key, label: trimmed };
    }),
  ];
};

const toHorizontalGroups = (groups: Flm1ReportGroup[]): Flm1ReportGroup[] =>
  groups.map((group) => {
    if (group.empty) {
      return group;
    }

    const currencyColumns = group.blocks.flatMap((block) =>
      block.columns.filter((column) => column.key !== PARTICULARS_KEY),
    );
    const templateRows =
      group.blocks[0]?.rows.filter((row) => row.rowType !== "HEADER") ?? [];
    const columns = toHorizontalColumns(templateRows);
    const rows: Flm1ReportRow[] = currencyColumns.map((currency) => {
      const row: Flm1ReportRow = {
        rowType: "ITEM",
        lineKey: currency.key,
        particulars: currency.label,
      };
      group.blocks.forEach((block) => {
        if (!block.columns.some((column) => column.key === currency.key)) {
          return;
        }
        block.rows
          .filter((line) => line.rowType !== "HEADER")
          .forEach((line) => {
            row[line.lineKey] = line[currency.key] ?? "";
          });
      });
      return row;
    });

    return {
      ...group,
      blocks: [{ columns, rows }],
    };
  });

const buildHorizontalHeader = (columns: Flm1ReportColumn[]) => {
  const groupRow: string[] = [];
  const labelRow: string[] = [];
  const merges: XLSX.Range[] = [];
  let index = 0;

  while (index < columns.length) {
    const column = columns[index];
    if (column.groupLabel) {
      let end = index;
      while (
        end + 1 < columns.length &&
        columns[end + 1].groupLabel === column.groupLabel
      ) {
        end += 1;
      }
      for (let current = index; current <= end; current += 1) {
        groupRow.push(current === index ? column.groupLabel : "");
        labelRow.push(columns[current].label);
      }
      if (end > index) {
        merges.push({ s: { r: 0, c: index }, e: { r: 0, c: end } });
      }
      index = end + 1;
      continue;
    }

    groupRow.push(column.label);
    labelRow.push("");
    merges.push({ s: { r: 0, c: index }, e: { r: 1, c: index } });
    index += 1;
  }

  return { groupRow, labelRow, merges };
};

const buildHorizontalWorksheet = (report: Flm8CnStatementResponse) => {
  const aoa: string[][] = [];
  const merges: XLSX.Range[] = [];

  report.groups.forEach((group) => {
    aoa.push([group.branchLabel]);
    if (group.empty) {
      aoa.push([group.emptyMessage || "No CN stock or movement"]);
      aoa.push([]);
      return;
    }

    const block = group.blocks[0];
    if (!block) {
      aoa.push([]);
      return;
    }

    const headerStart = aoa.length;
    const header = buildHorizontalHeader(block.columns);
    aoa.push(header.groupRow);
    aoa.push(header.labelRow);
    header.merges.forEach((merge) => {
      merges.push({
        s: { r: merge.s.r + headerStart, c: merge.s.c },
        e: { r: merge.e.r + headerStart, c: merge.e.c },
      });
    });

    block.rows.forEach((row) => {
      aoa.push(block.columns.map((column) => row[column.key] ?? ""));
    });
    aoa.push([]);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  if (merges.length) {
    worksheet["!merges"] = merges;
  }
  return worksheet;
};

export const buildFlm8CnStatement = (
  sourceRows: Parameters<typeof buildFlm1DailyCnSummary>[0],
  options: {
    startDate: string;
    endDate: string;
    view?: string;
    currenciesPerBlock: number;
    selectedBranches: Flm1BranchMeta[];
    saleGroups?: Flm1SaleGroup[];
    currencyLabelById?: Record<string, string>;
  },
): Flm8CnStatementResponse => {
  const view = resolveView(options.view);
  const vertical = buildFlm1DailyCnSummary(sourceRows, {
    dateLabel: `${options.startDate} to ${options.endDate}`,
    currenciesPerBlock: options.currenciesPerBlock,
    selectedBranches: options.selectedBranches,
    saleGroups: options.saleGroups,
    currencyLabelById: options.currencyLabelById,
  });

  return {
    ...vertical,
    view,
    startDate: options.startDate,
    endDate: options.endDate,
    groups:
      view === Flm8CnStatementView.HORIZONTAL
        ? toHorizontalGroups(vertical.groups)
        : vertical.groups,
  };
};

export const buildFlm8CnStatementExport = (
  report: Flm8CnStatementResponse,
  format: CardSettlementReportFormat,
) => {
  if (report.view !== Flm8CnStatementView.HORIZONTAL) {
    const payload = buildFlm1DailyCnSummaryExport(report, format);
    return {
      ...payload,
      filename:
        format === CardSettlementReportFormat.CSV
          ? "flm8-cn-statement.csv"
          : "flm8-cn-statement.xlsx",
    };
  }

  const worksheet = buildHorizontalWorksheet(report);

  if (format === CardSettlementReportFormat.CSV) {
    return {
      buffer: Buffer.from(XLSX.utils.sheet_to_csv(worksheet), "utf8"),
      contentType: "text/csv; charset=utf-8",
      filename: "flm8-cn-statement.csv",
    };
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "FLM8");
  return {
    buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer,
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: "flm8-cn-statement.xlsx",
  };
};
