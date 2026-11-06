import { DataSource } from "typeorm";
import * as XLSX from "xlsx";
import { toDisplayDateOnly } from "../common/date/date.util";
import { CreditRequestFundStatus } from "../credit-request-fund/credit-request-fund.enums";
import { AdvanceRefundStatus } from "../advance-refund/advance-refund.enums";
import { VoucherAdvanceApplicationState } from "../vouchers/voucher.enums";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import {
  AfcReconciliationReportLayout,
  AfcReconciliationReportScope,
  type AfcReconciliationReportLayout as ReportLayout,
  type AfcReconciliationReportScope as ReportScope,
} from "./dto/afc-reconciliation-report-query.dto";
import { resolveOutstandingDateRange } from "./outstanding-transaction-report.helpers";

export type AfcColumn = { key: string; label: string };
export type AfcRow = Record<string, string> & {
  lineKey: string;
  rowType: "BRANCH" | "PARTY" | "ITEM" | "TOTAL";
};

export type AfcReconciliationReportResponse = {
  startDate: string;
  endDate: string;
  accountingDate: string;
  layout: ReportLayout;
  scope: ReportScope;
  message: string;
  columns: AfcColumn[];
  rows: AfcRow[];
};

type SourceRow = {
  id: string;
  number: string | null;
  transactionDate: Date | string;
  branchId: string;
  counterId: string | null;
  partyProfileId: string | null;
  panNumber: string | null;
  narration: string | null;
  finalAmount: string | number | null;
  branchSnapshot: unknown;
  partyProfileSnapshot: unknown;
  advanceControlAccountSnapshot: unknown;
  billsAdjusted: string | number | null;
  refundsAdjusted: string | number | null;
};

const DETAIL_COLUMNS: AfcColumn[] = [
  { key: "date", label: "Date" },
  { key: "voucherNo", label: "Voucher No" },
  { key: "branch", label: "Branch" },
  { key: "account", label: "Account" },
  { key: "panNo", label: "Pan No" },
  { key: "partyCode", label: "Party Code" },
  { key: "partyName", label: "Party Name" },
  { key: "narration", label: "Narration" },
  { key: "advanceAmount", label: "Advance Amount" },
  { key: "adjustedAmount", label: "Adjusted Amount" },
  { key: "balance", label: "Balance" },
];

const SUMMARY_COLUMNS: AfcColumn[] = [
  { key: "branch", label: "Branch" },
  { key: "account", label: "Account" },
  { key: "panNo", label: "Pan No" },
  { key: "partyCode", label: "Party Code" },
  { key: "partyName", label: "Party Name" },
  { key: "advanceAmount", label: "Advance Amount" },
  { key: "adjustedAmount", label: "Adjusted Amount" },
  { key: "balance", label: "Balance" },
];

const textOf = (value: unknown) => String(value ?? "").trim();

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
    const value = textOf(snapshot[key]);
    if (value) {
      return value;
    }
  }
  return "";
};

const moneyOf = (value: unknown) => {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
};

const formatMoney = (value: number) =>
  (Number.isFinite(value) ? value : 0).toFixed(2);

export const resolveAfcDateRange = resolveOutstandingDateRange;

export const loadAfcReconciliationSourceRows = async (
  database2: DataSource,
  filters: {
    startDate: Date;
    endDateExclusive: Date;
    accountingDate: string;
    branchIds: string[];
    counterIds: string[];
  },
): Promise<SourceRow[]> => {
  const params: unknown[] = [
    filters.startDate,
    filters.endDateExclusive,
    filters.accountingDate.slice(0, 10),
  ];
  const conditions = [
    "crf.deleted_at IS NULL",
    `crf.status = '${CreditRequestFundStatus.APPROVE}'`,
    "crf.requesting_receipt_voucher_id IS NOT NULL",
    "v.deleted_at IS NULL",
    "v.transaction_date >= $1",
    "v.transaction_date < $2",
    "v.transaction_date <= $3::date",
  ];

  if (filters.branchIds.length) {
    const placeholders = filters.branchIds.map((branchId) => {
      params.push(branchId);
      return `$${params.length}`;
    });
    conditions.push(`v.branch_id IN (${placeholders.join(", ")})`);
  }

  if (filters.counterIds.length) {
    const placeholders = filters.counterIds.map((counterId) => {
      params.push(counterId);
      return `$${params.length}`;
    });
    conditions.push(`v.counter_id IN (${placeholders.join(", ")})`);
  }

  return database2.query(
    `SELECT
        v.id AS "id",
        v.number AS "number",
        v.transaction_date AS "transactionDate",
        v.branch_id AS "branchId",
        v.counter_id AS "counterId",
        v.party_profile_id AS "partyProfileId",
        v.pan_number AS "panNumber",
        v.narration AS "narration",
        v.final_amount AS "finalAmount",
        v.branch_snapshot AS "branchSnapshot",
        v.party_profile_snapshot AS "partyProfileSnapshot",
        v.advance_control_account_snapshot AS "advanceControlAccountSnapshot",
        COALESCE((
          SELECT SUM(app.amount::numeric)
          FROM voucher_advance_applications app
          INNER JOIN transactions tx ON tx.id = app.transaction_id
          WHERE app.voucher_id = v.id
            AND app.deleted_at IS NULL
            AND tx.deleted_at IS NULL
            AND app.state = '${VoucherAdvanceApplicationState.APPLIED}'
            AND tx.transaction_date <= $3::date
        ), 0) AS "billsAdjusted",
        COALESCE((
          SELECT SUM(ari.refund_amount::numeric)
          FROM advance_refund_items ari
          INNER JOIN advance_refund ar ON ar.id = ari.advance_refund_id
          WHERE ari.receipt_voucher_id = v.id
            AND ari.deleted_at IS NULL
            AND ar.deleted_at IS NULL
            AND ar.status <> '${AdvanceRefundStatus.CANCELLED}'
            AND ar.transaction_date <= $3::date
        ), 0) AS "refundsAdjusted"
      FROM credit_request_funds crf
      INNER JOIN accounting_vouchers v
        ON v.id = crf.requesting_receipt_voucher_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY
        COALESCE(v.branch_snapshot->>'code', v.branch_snapshot->>'name', v.branch_id::text) ASC,
        COALESCE(v.pan_number, ''),
        COALESCE(v.party_profile_snapshot->>'code', v.party_profile_snapshot->>'name', ''),
        v.transaction_date ASC,
        v.number ASC`,
    params,
  );
};

type PreparedLine = {
  id: string;
  branchId: string;
  branchCode: string;
  branchLabel: string;
  partyKey: string;
  panNo: string;
  partyCode: string;
  partyName: string;
  account: string;
  date: string;
  voucherNo: string;
  narration: string;
  advanceAmount: number;
  adjustedAmount: number;
  balance: number;
};

const prepareLines = (sourceRows: SourceRow[]): PreparedLine[] =>
  sourceRows.flatMap((row) => {
    const advanceAmount = moneyOf(row.finalAmount);
    const adjustedAmount =
      moneyOf(row.billsAdjusted) + moneyOf(row.refundsAdjusted);
    const balance = advanceAmount - adjustedAmount;
    if (Math.abs(balance) < 0.0000001) {
      return [];
    }
    const branch = parseSnapshot(row.branchSnapshot);
    const party = parseSnapshot(row.partyProfileSnapshot);
    const account = parseSnapshot(row.advanceControlAccountSnapshot);
    const branchCode =
      snapshotText(branch, ["code"]) || textOf(row.branchId);
    const branchName = snapshotText(branch, ["name"]);
    const panNo = textOf(row.panNumber);
    const partyCode = snapshotText(party, ["code"]);
    const partyName = snapshotText(party, ["name"]);
    const partyKey =
      panNo ||
      textOf(row.partyProfileId) ||
      [partyCode, partyName].filter(Boolean).join("|") ||
      row.id;

    return [
      {
        id: row.id,
        branchId: textOf(row.branchId),
        branchCode,
        branchLabel: branchName ? `${branchCode} - ${branchName}` : branchCode,
        partyKey,
        panNo,
        partyCode,
        partyName,
        account:
          snapshotText(account, ["code", "name", "label"]) || "AFC",
        date: toDisplayDateOnly(row.transactionDate),
        voucherNo: textOf(row.number),
        narration: textOf(row.narration),
        advanceAmount,
        adjustedAmount,
        balance,
      },
    ];
  });

const emptyMoneyRow = (
  rowType: AfcRow["rowType"],
  lineKey: string,
  overrides: Record<string, string>,
): AfcRow =>
  ({
    lineKey,
    rowType,
    date: "",
    voucherNo: "",
    branch: "",
    account: "",
    panNo: "",
    partyCode: "",
    partyName: "",
    narration: "",
    advanceAmount: "",
    adjustedAmount: "",
    balance: "",
    ...overrides,
  }) as AfcRow;

const itemRow = (line: PreparedLine, showBranch: boolean): AfcRow =>
  ({
    lineKey: `item-${line.id}`,
    rowType: "ITEM",
    date: line.date,
    voucherNo: line.voucherNo,
    branch: showBranch ? line.branchCode : "",
    account: line.account,
    panNo: line.panNo,
    partyCode: line.partyCode,
    partyName: line.partyName,
    narration: line.narration,
    advanceAmount: formatMoney(line.advanceAmount),
    adjustedAmount: formatMoney(line.adjustedAmount),
    balance: formatMoney(line.balance),
  }) as AfcRow;

const summaryItemRow = (
  lines: PreparedLine[],
  showBranch: boolean,
): AfcRow => {
  const first = lines[0];
  const advanceAmount = lines.reduce(
    (total, line) => total + line.advanceAmount,
    0,
  );
  const adjustedAmount = lines.reduce(
    (total, line) => total + line.adjustedAmount,
    0,
  );
  const balance = lines.reduce((total, line) => total + line.balance, 0);
  return {
    lineKey: `summary-${first.branchId}-${first.partyKey}`,
    rowType: "ITEM",
    date: "",
    voucherNo: "",
    branch: showBranch ? first.branchCode : "",
    account: first.account,
    panNo: first.panNo,
    partyCode: first.partyCode,
    partyName: first.partyName,
    narration: "",
    advanceAmount: formatMoney(advanceAmount),
    adjustedAmount: formatMoney(adjustedAmount),
    balance: formatMoney(balance),
  } as AfcRow;
};

export const buildAfcReconciliationReport = (
  sourceRows: SourceRow[],
  input: {
    startDate: string;
    endDate: string;
    accountingDate: string;
    layout?: ReportLayout;
    scope?: ReportScope;
  },
): AfcReconciliationReportResponse => {
  const layout = input.layout ?? AfcReconciliationReportLayout.DETAIL;
  const scope = input.scope ?? AfcReconciliationReportScope.BRANCH;
  const lines = prepareLines(sourceRows);
  const columns =
    layout === AfcReconciliationReportLayout.SUMMARY
      ? SUMMARY_COLUMNS.map((column) => ({ ...column }))
      : DETAIL_COLUMNS.map((column) => ({ ...column }));
  const rows: AfcRow[] = [];
  const branchScope = scope === AfcReconciliationReportScope.BRANCH;

  if (!lines.length) {
    return {
      startDate: input.startDate,
      endDate: input.endDate,
      accountingDate: input.accountingDate,
      layout,
      scope,
      message: "No outstanding AFC advances for the selected filters.",
      columns,
      rows,
    };
  }

  const byBranch = new Map<string, PreparedLine[]>();
  lines.forEach((line) => {
    const key = branchScope ? line.branchId : "ALL";
    const current = byBranch.get(key) ?? [];
    current.push(line);
    byBranch.set(key, current);
  });

  let totalAdvance = 0;
  let totalAdjusted = 0;
  let totalBalance = 0;

  byBranch.forEach((branchLines, branchKey) => {
    if (branchScope) {
      rows.push(
        emptyMoneyRow("BRANCH", `branch-${branchKey}`, {
          branch: branchLines[0].branchCode,
          partyName: branchLines[0].branchLabel,
        }),
      );
    }

    const byParty = new Map<string, PreparedLine[]>();
    branchLines.forEach((line) => {
      const current = byParty.get(line.partyKey) ?? [];
      current.push(line);
      byParty.set(line.partyKey, current);
    });

    byParty.forEach((partyLines, partyKey) => {
      if (layout === AfcReconciliationReportLayout.DETAIL) {
        rows.push(
          emptyMoneyRow("PARTY", `party-${branchKey}-${partyKey}`, {
            partyCode: partyLines[0].partyCode,
            partyName: partyLines[0].partyName || partyLines[0].panNo,
          }),
        );
        partyLines.forEach((line) => {
          rows.push(itemRow(line, branchScope));
          totalAdvance += line.advanceAmount;
          totalAdjusted += line.adjustedAmount;
          totalBalance += line.balance;
        });
      } else {
        const summary = summaryItemRow(partyLines, branchScope);
        rows.push(summary);
        totalAdvance += moneyOf(summary.advanceAmount);
        totalAdjusted += moneyOf(summary.adjustedAmount);
        totalBalance += moneyOf(summary.balance);
      }
    });
  });

  rows.push(
    emptyMoneyRow("TOTAL", "grand-total", {
      partyName: "Total",
      advanceAmount: formatMoney(totalAdvance),
      adjustedAmount: formatMoney(totalAdjusted),
      balance: formatMoney(totalBalance),
    }),
  );

  return {
    startDate: input.startDate,
    endDate: input.endDate,
    accountingDate: input.accountingDate,
    layout,
    scope,
    message: "",
    columns,
    rows,
  };
};

export const buildAfcReconciliationExport = (
  report: AfcReconciliationReportResponse,
  format: CardSettlementReportFormat,
) => {
  const extension = format === CardSettlementReportFormat.CSV ? "csv" : "xlsx";
  const filename = `afc-reconciliation-report-${report.startDate}-to-${report.endDate}.${extension}`;
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
  XLSX.utils.book_append_sheet(workbook, sheet, "AFC Reconciliation");
  return {
    filename,
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer,
  };
};
