import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import * as XLSX from "xlsx";
import { SessionContext } from "../auth/types/session-context";
import { Branch } from "../branches/branch.entity";
import { Transaction } from "../transactions/entities/transaction.entity";
import {
  TransactionStatus,
  TransactionType,
} from "../transactions/transactions.enums";
import { UserRole } from "../user-roles/user-role.entity";
import {
  TradingSummaryDiffFilter,
  TradingSummaryReportFormat,
  TradingSummaryReportQueryDto,
  TradingSummaryReportScope,
} from "./dto/trading-summary-report-query.dto";
import { resolveFlmAccessibleBranchIds } from "./flm-report-access.helpers";

type ReportColumn = { key: string; label: string };

type ReportRow = {
  product: string;
  opening: string;
  purchase: string;
  sales: string;
  closing: string;
  diff: string;
};

const DIFF_EPSILON = 0.005;

type ReportSection = {
  branchId: string | null;
  branchLabel: string;
  rows: ReportRow[];
};

type RawMovementRow = {
  branch_id: string;
  product_id: string;
  product_label: string;
  currency_id: string;
  transaction_date: string;
  created_at: string;
  transaction_id: string;
  transaction_type: TransactionType;
  quantity: string | number;
  purchase_rs: string | number;
  sale_hold_cost_amount: string | number;
  settlement_cogs_rs: string | number | null;
};

type BucketState = {
  branchId: string;
  productId: string;
  productLabel: string;
  runningQty: number;
  runningRs: number;
  openingRs: number;
  periodPurchaseRs: number;
  periodSalesRs: number;
  openingCaptured: boolean;
};

type ProductTotals = {
  productId: string;
  productLabel: string;
  openingRs: number;
  purchaseRs: number;
  salesRs: number;
  closingRs: number;
};

const COLUMNS: ReportColumn[] = [
  { key: "product", label: "product" },
  { key: "opening", label: "opening" },
  { key: "purchase", label: "purchase" },
  { key: "sales", label: "sales" },
  { key: "closing", label: "closing" },
  { key: "diff", label: "diff" },
];

const toText = (value: unknown) => {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim();
};

const toDateOnly = (value: unknown) => {
  const raw = toText(value);
  return raw ? raw.slice(0, 10) : "";
};

const toNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundMoney = (value: number) =>
  (Math.round((Number.isFinite(value) ? value : 0) * 100) / 100).toFixed(2);

const moneyNumber = (value: number) =>
  Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;

@Injectable()
export class TradingSummaryReportService {
  constructor(
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(Transaction, "database2")
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  async buildReport(
    query: TradingSummaryReportQueryDto,
    session?: SessionContext,
  ) {
    const startDate = toDateOnly(query.startDate);
    const endDate = toDateOnly(query.endDate);
    if (!startDate || !endDate) {
      throw new BadRequestException("Start date and end date are required");
    }
    if (startDate > endDate) {
      throw new BadRequestException("Start date cannot be after end date");
    }

    const scope = query.scope ?? TradingSummaryReportScope.BRANCH;
    const diffFilter = query.diffFilter ?? TradingSummaryDiffFilter.HAS_DIFF;
    const branchIds = await resolveFlmAccessibleBranchIds(
      this.userRoleRepository,
      query.branchIds ?? [],
      session,
    );
    const [branchLabelById, rows] = await Promise.all([
      this.resolveBranchLabels(branchIds),
      this.loadMovementRows(branchIds, endDate),
    ]);

    if (!rows.length) {
      return {
        startDate,
        endDate,
        scope,
        diffFilter,
        message: "No trading stock movements found for the selected filters.",
        columns: COLUMNS.map((column) => ({ ...column })),
        sections: [] as ReportSection[],
      };
    }

    const branchSections = this.buildBranchSections({
      branchIds,
      branchLabelById,
      rows,
      startDate,
      endDate,
    });

    const sections =
      scope === TradingSummaryReportScope.CONSOLIDATED
        ? [
            this.filterSectionRows(
              this.consolidateSections(branchSections),
              diffFilter,
            ),
          ].filter((section) => section.rows.length > 0)
        : branchSections
            .map((section) => this.filterSectionRows(section, diffFilter))
            .filter((section) => section.rows.length > 0);

    return {
      startDate,
      endDate,
      scope,
      diffFilter,
      message: sections.length
        ? ""
        : diffFilter === TradingSummaryDiffFilter.HAS_DIFF
          ? "No products with a stock difference for the selected filters."
          : "No balanced (zero-diff) trading stock rows for the selected filters.",
      columns: COLUMNS.map((column) => ({ ...column })),
      sections,
    };
  }

  async buildExport(
    query: TradingSummaryReportQueryDto,
    format: TradingSummaryReportFormat,
    session?: SessionContext,
  ) {
    const report = await this.buildReport(query, session);
    const exportRows: Array<Record<string, string>> = [];

    for (const section of report.sections) {
      if (report.scope === TradingSummaryReportScope.BRANCH) {
        exportRows.push({
          branch: section.branchLabel,
          product: "",
          opening: "",
          purchase: "",
          sales: "",
          closing: "",
          diff: "",
        });
      }
      for (const row of section.rows) {
        exportRows.push({
          branch:
            report.scope === TradingSummaryReportScope.BRANCH
              ? section.branchLabel
              : "All Branches",
          product: row.product,
          opening: row.opening,
          purchase: row.purchase,
          sales: row.sales,
          closing: row.closing,
          diff: row.diff,
        });
      }
    }

    const worksheet = XLSX.utils.json_to_sheet(
      exportRows.length
        ? exportRows
        : [
            {
              branch: "",
              product: "",
              opening: "",
              purchase: "",
              sales: "",
              closing: "",
              diff: "",
            },
          ],
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Trading Summary");

    const filename = `trading-summary-report-${report.startDate}-to-${report.endDate}.${
      format === TradingSummaryReportFormat.CSV ? "csv" : "xlsx"
    }`;

    if (format === TradingSummaryReportFormat.CSV) {
      return {
        buffer: Buffer.from(XLSX.utils.sheet_to_csv(worksheet), "utf8"),
        contentType: "text/csv; charset=utf-8",
        filename,
      };
    }

    return {
      buffer: XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }),
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename,
    };
  }

  private async resolveBranchLabels(branchIds: string[]) {
    if (!branchIds.length) {
      return new Map<string, string>();
    }
    const branches = await this.branchRepository.find({
      where: { id: In(branchIds) },
      select: ["id", "name", "code"],
    });
    return new Map(
      branches.map((branch) => [
        branch.id,
        toText(branch.name) || toText(branch.code) || branch.id,
      ]),
    );
  }

  private async loadMovementRows(branchIds: string[], endDate: string) {
    if (!branchIds.length) {
      return [] as RawMovementRow[];
    }

    // Lean projection only — avoid hydrating full transaction/item entities + jsonb blobs.
    return (await this.transactionRepository.query(
      `
        SELECT
          t.branch_id AS branch_id,
          ti.product_id AS product_id,
          CASE
            WHEN NULLIF(BTRIM(ti.product_snapshot->>'code'), '') IS NOT NULL
             AND NULLIF(BTRIM(ti.product_snapshot->>'name'), '') IS NOT NULL
              THEN BTRIM(ti.product_snapshot->>'code') || ' - ' || BTRIM(ti.product_snapshot->>'name')
            ELSE COALESCE(
              NULLIF(BTRIM(ti.product_snapshot->>'label'), ''),
              NULLIF(BTRIM(ti.product_snapshot->>'name'), ''),
              NULLIF(BTRIM(ti.product_snapshot->>'code'), ''),
              ti.product_id::text
            )
          END AS product_label,
          ti.currency_id AS currency_id,
          to_char((t.transaction_date AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS transaction_date,
          to_char(t.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
          t.id AS transaction_id,
          t.transaction_type AS transaction_type,
          ti.quantity AS quantity,
          (ti.quantity::float8 * (ti.rate::float8 / NULLIF(COALESCE(ti.per, 1)::float8, 0))) AS purchase_rs,
          (
            ti.quantity::float8
            * CASE
                WHEN COALESCE(ti.hold_cost, 0)::float8 > 0 THEN ti.hold_cost::float8
                ELSE (ti.rate::float8 / NULLIF(COALESCE(ti.per, 1)::float8, 0))
              END
          ) AS sale_hold_cost_amount,
          CASE
            WHEN (ti.card_id IS NOT NULL OR ti.deal_cover_id IS NOT NULL)
             AND ti.profit_amount IS NOT NULL
              THEN (
                ti.quantity::float8
                * (ti.rate::float8 / NULLIF(COALESCE(ti.per, 1)::float8, 0))
              ) - ti.profit_amount::float8
            ELSE NULL
          END AS settlement_cogs_rs
        FROM transactions t
        INNER JOIN transaction_items ti ON ti.transaction_id = t.id
        WHERE t.status = $1
          AND t.is_latest = true
          AND t.transaction_type IN ($2, $3)
          AND t.branch_id = ANY($4::uuid[])
          AND (t.transaction_date AT TIME ZONE 'UTC')::date <= $5::date
          AND ti.product_id IS NOT NULL
          AND ti.currency_id IS NOT NULL
          AND ti.quantity IS NOT NULL
          AND ti.quantity::float8 <> 0
        ORDER BY
          t.transaction_date ASC,
          t.created_at ASC,
          t.id ASC,
          ti.line_no ASC
      `,
      [
        TransactionStatus.APPROVED,
        TransactionType.PURCHASE,
        TransactionType.SALE,
        branchIds,
        endDate,
      ],
    )) as RawMovementRow[];
  }

  private buildBranchSections(input: {
    branchIds: string[];
    branchLabelById: Map<string, string>;
    rows: RawMovementRow[];
    startDate: string;
    endDate: string;
  }): ReportSection[] {
    const buckets = new Map<string, BucketState>();

    for (const row of input.rows) {
      const branchId = row.branch_id;
      const productId = row.product_id;
      const currencyId = row.currency_id;
      const transactionDate = toDateOnly(row.transaction_date);
      if (!branchId || !productId || !currencyId || !transactionDate) {
        continue;
      }

      const key = `${branchId}|${productId}|${currencyId}`;
      let state = buckets.get(key);
      if (!state) {
        state = {
          branchId,
          productId,
          productLabel: toText(row.product_label) || productId,
          runningQty: 0,
          runningRs: 0,
          openingRs: 0,
          periodPurchaseRs: 0,
          periodSalesRs: 0,
          openingCaptured: false,
        };
        buckets.set(key, state);
      } else if (row.product_label) {
        state.productLabel = toText(row.product_label) || state.productLabel;
      }

      if (!state.openingCaptured && transactionDate >= input.startDate) {
        state.openingRs = state.runningRs;
        state.openingCaptured = true;
      }

      const quantity = toNumber(row.quantity);
      let purchaseQty = 0;
      let purchaseRs = 0;
      let sellQty = 0;
      let awpSellRs = 0;
      let reportedSellRs = 0;

      if (row.transaction_type === TransactionType.PURCHASE) {
        purchaseQty = quantity;
        purchaseRs = toNumber(row.purchase_rs);
      } else {
        sellQty = quantity;
        const averageCost =
          state.runningQty > 0 ? state.runningRs / state.runningQty : 0;
        const saleHoldCostAmount = toNumber(row.sale_hold_cost_amount);
        const fallbackUnitRate = quantity > 0 ? saleHoldCostAmount / quantity : 0;
        const awpUnitCost = averageCost > 0 ? averageCost : fallbackUnitRate;
        awpSellRs = sellQty * awpUnitCost;

        if (row.settlement_cogs_rs !== null && row.settlement_cogs_rs !== undefined) {
          reportedSellRs = toNumber(row.settlement_cogs_rs);
        } else if (saleHoldCostAmount > 0) {
          reportedSellRs = saleHoldCostAmount;
        } else {
          reportedSellRs = awpSellRs;
        }
      }

      state.runningQty += purchaseQty - sellQty;
      state.runningRs += purchaseRs - awpSellRs;

      if (
        transactionDate >= input.startDate &&
        transactionDate <= input.endDate
      ) {
        state.periodPurchaseRs += purchaseRs;
        state.periodSalesRs += reportedSellRs;
      }
    }

    const totalsByBranch = new Map<string, Map<string, ProductTotals>>();

    for (const state of buckets.values()) {
      if (!state.openingCaptured) {
        state.openingRs = state.runningRs;
      }

      const openingRs = moneyNumber(state.openingRs);
      const purchaseRs = moneyNumber(state.periodPurchaseRs);
      const salesRs = moneyNumber(state.periodSalesRs);
      const closingRs = moneyNumber(state.runningRs);

      if (
        Math.abs(openingRs) <= 0.0001 &&
        Math.abs(purchaseRs) <= 0.0001 &&
        Math.abs(salesRs) <= 0.0001 &&
        Math.abs(closingRs) <= 0.0001
      ) {
        continue;
      }

      let productMap = totalsByBranch.get(state.branchId);
      if (!productMap) {
        productMap = new Map();
        totalsByBranch.set(state.branchId, productMap);
      }

      const existing = productMap.get(state.productId) ?? {
        productId: state.productId,
        productLabel: state.productLabel,
        openingRs: 0,
        purchaseRs: 0,
        salesRs: 0,
        closingRs: 0,
      };
      existing.productLabel = state.productLabel || existing.productLabel;
      existing.openingRs += openingRs;
      existing.purchaseRs += purchaseRs;
      existing.salesRs += salesRs;
      existing.closingRs += closingRs;
      productMap.set(state.productId, existing);
    }

    return input.branchIds
      .map((branchId) => {
        const productMap = totalsByBranch.get(branchId);
        const rows = productMap
          ? [...productMap.values()]
              .sort((left, right) =>
                left.productLabel.localeCompare(right.productLabel),
              )
              .map((row) =>
                this.toReportRow({
                  product: row.productLabel,
                  opening: row.openingRs,
                  purchase: row.purchaseRs,
                  sales: row.salesRs,
                  closing: row.closingRs,
                }),
              )
          : [];

        return {
          branchId,
          branchLabel: input.branchLabelById.get(branchId) || branchId,
          rows,
        };
      })
      .filter((section) => section.rows.length > 0);
  }

  private rowHasDiff(row: ReportRow) {
    return Math.abs(Number(row.diff)) > DIFF_EPSILON;
  }

  private filterSectionRows(
    section: ReportSection,
    diffFilter: TradingSummaryDiffFilter,
  ): ReportSection {
    const rows =
      diffFilter === TradingSummaryDiffFilter.HAS_DIFF
        ? section.rows.filter((row) => this.rowHasDiff(row))
        : section.rows.filter((row) => !this.rowHasDiff(row));
    return {
      ...section,
      rows,
    };
  }

  private toReportRow(input: {
    product: string;
    opening: number;
    purchase: number;
    sales: number;
    closing: number;
  }): ReportRow {
    const opening = moneyNumber(input.opening);
    const purchase = moneyNumber(input.purchase);
    const sales = moneyNumber(input.sales);
    const closing = moneyNumber(input.closing);
    const diff = moneyNumber(opening + purchase - sales - closing);
    return {
      product: input.product,
      opening: roundMoney(opening),
      purchase: roundMoney(purchase),
      sales: roundMoney(sales),
      closing: roundMoney(closing),
      diff: roundMoney(diff),
    };
  }

  private consolidateSections(sections: ReportSection[]): ReportSection {
    const totals = new Map<
      string,
      {
        product: string;
        opening: number;
        purchase: number;
        sales: number;
        closing: number;
      }
    >();

    for (const section of sections) {
      for (const row of section.rows) {
        const existing = totals.get(row.product) ?? {
          product: row.product,
          opening: 0,
          purchase: 0,
          sales: 0,
          closing: 0,
        };
        existing.opening += Number(row.opening);
        existing.purchase += Number(row.purchase);
        existing.sales += Number(row.sales);
        existing.closing += Number(row.closing);
        totals.set(row.product, existing);
      }
    }

    const rows = [...totals.values()]
      .sort((left, right) => left.product.localeCompare(right.product))
      .map((row) => this.toReportRow(row));

    return {
      branchId: null,
      branchLabel: "All Branches",
      rows,
    };
  }
}
