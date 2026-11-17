import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import * as XLSX from "xlsx";
import { AccountProfile } from "../account-profiles/account-profile.entity";
import { SessionContext } from "../auth/types/session-context";
import { Branch } from "../branches/branch.entity";
import { Product } from "../products/product.entity";
import { TransactionPostingDirection } from "../transactions/transactions.enums";
import { UserRole } from "../user-roles/user-role.entity";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import {
  FinalAccountReportQueryDto,
  FinalAccountReportScope,
  FinalAccountStatementType,
} from "./dto/final-account-report-query.dto";
import { resolveFlmAccessibleBranchIds } from "./flm-report-access.helpers";
import {
  applyCodeBasedProfitMergeTargets,
  applyProfitMergeToBuckets,
  resolveProfitMergeTargetsFromProducts,
} from "./profit-merge.util";

type ReportColumn = { key: string; label: string };

type AccountMeta = {
  id: string;
  accountCode: string;
  accountName: string;
};

type AggregateBucket = {
  branchId: string | null;
  branchCode: string;
  accountId: string;
  openingCents: number;
  periodDebitCents: number;
  periodCreditCents: number;
};

type SideRow = {
  code: string;
  name: string;
  amount: string;
};

type TradingSection = {
  branchId: string | null;
  branchLabel: string;
  debitRows: SideRow[];
  creditRows: SideRow[];
  debitTotal: string;
  creditTotal: string;
};

const DEBIT_COLUMNS: ReportColumn[] = [
  { key: "debitCode", label: "Code" },
  { key: "debitName", label: "Debit" },
  { key: "debitAmount", label: "Amount" },
];

const CREDIT_COLUMNS: ReportColumn[] = [
  { key: "creditCode", label: "Code" },
  { key: "creditName", label: "Credit" },
  { key: "creditAmount", label: "Amount" },
];

// Stock/transfer plumbing only — keep settlement (PUR*/PRO*) on the Trading statement.
const TECHNICAL_SLUGS = [
  "CARD_STOCK",
  "CARD_TRANSFER_OUT",
  "CARD_TRANSFER_IN",
  "CARD_STOCK_LOAD",
  "CARD_SELL",
  "CARD_RETURN",
  "CARD_VOID",
];

const isTradingAccountCode = (accountCode: string) =>
  /^(PUR|SAL|SELL|PRO)/i.test(accountCode);

const toText = (value: unknown) => String(value ?? "").trim();

const normalizeUpper = (value: unknown) =>
  toText(value)
    .replace(/[\s-]+/g, "_")
    .toUpperCase();

const money = (cents: number) => (cents / 100).toFixed(2);

const cents = (value: unknown) => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100);
};

const toDateOnly = (value: unknown) => {
  const raw = toText(value);
  return raw ? raw.slice(0, 10) : "";
};

const isTradingType = (label: string, value: string) => {
  const normalizedLabel = normalizeUpper(label).replace(/&/g, "AND");
  const normalizedValue = normalizeUpper(value);
  return (
    normalizedValue === "T" ||
    normalizedLabel === "TRADING" ||
    normalizedLabel.includes("TRADING")
  );
};

const emptySideRow = (): SideRow => ({ code: "", name: "", amount: "" });

@Injectable()
export class FinalAccountReportService {
  constructor(
    @InjectDataSource("database2")
    private readonly database2: DataSource,
    @InjectRepository(AccountProfile)
    private readonly accountRepository: Repository<AccountProfile>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async buildReport(
    query: FinalAccountReportQueryDto,
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

    const scope = query.scope ?? FinalAccountReportScope.BRANCH;
    const statementType =
      query.statementType ?? FinalAccountStatementType.TRADING;
    const mergeProfit = query.mergeProfit === true;
    const branchIds = await resolveFlmAccessibleBranchIds(
      this.userRoleRepository,
      query.branchIds ?? [],
      session,
    );

    if (statementType !== FinalAccountStatementType.TRADING) {
      return this.stubResponse(
        startDate,
        endDate,
        scope,
        statementType,
        mergeProfit,
      );
    }

    const accounts = await this.resolveTradingAccounts();
    if (!accounts.length) {
      return this.emptyTradingResponse(
        startDate,
        endDate,
        scope,
        mergeProfit,
        "No TRADING accounts available for the selected filters.",
      );
    }

    const accountById = new Map(accounts.map((account) => [account.id, account]));
    const accountIds = accounts.map((account) => account.id);
    const branchMetaById = await this.resolveBranchMeta(branchIds);

    const [openingRows, periodRows, productMergeMap] = await Promise.all([
      this.collectAggregates({
        accountIds,
        branchIds,
        beforeDate: startDate,
      }),
      this.collectAggregates({
        accountIds,
        branchIds,
        startDate,
        endDate,
      }),
      mergeProfit
        ? resolveProfitMergeTargetsFromProducts({
            productRepository: this.productRepository,
            database2: this.database2,
            branchIds,
            startDate,
            endDate,
            accountById,
            technicalSlugs: TECHNICAL_SLUGS,
          })
        : Promise.resolve(new Map<string, string>()),
    ]);

    const profitMergeMap = mergeProfit
      ? applyCodeBasedProfitMergeTargets(accountById, productMergeMap)
      : productMergeMap;

    let buckets = this.mergeBuckets({
      scope,
      openingRows,
      periodRows,
      branchMetaById,
    });

    if (mergeProfit && profitMergeMap.size) {
      buckets = applyProfitMergeToBuckets({
        buckets,
        profitMergeMap,
        branchMetaById,
        accountById,
      });
    }

    const sections = this.buildTradingSections({
      scope,
      buckets,
      accountById,
    });

    return {
      startDate,
      endDate,
      scope,
      statementType,
      mergeProfit,
      message: sections.length
        ? ""
        : "No trading account rows for the selected filters.",
      debitColumns: DEBIT_COLUMNS.map((column) => ({ ...column })),
      creditColumns: CREDIT_COLUMNS.map((column) => ({ ...column })),
      sections,
    };
  }

  async buildExport(
    query: FinalAccountReportQueryDto,
    format: CardSettlementReportFormat,
    session?: SessionContext,
  ) {
    const report = await this.buildReport(query, session);
    const header = [
      ...report.debitColumns.map((column) => column.label),
      ...report.creditColumns.map((column) => column.label),
    ];
    const body: string[][] = [];

    for (const section of report.sections) {
      if (section.branchLabel) {
        body.push([section.branchLabel, "", "", "", "", ""]);
      }
      const rowCount = Math.max(
        section.debitRows.length,
        section.creditRows.length,
      );
      for (let index = 0; index < rowCount; index += 1) {
        const debit = section.debitRows[index] ?? emptySideRow();
        const credit = section.creditRows[index] ?? emptySideRow();
        body.push([
          debit.code,
          debit.name,
          debit.amount,
          credit.code,
          credit.name,
          credit.amount,
        ]);
      }
      body.push([
        "",
        "Total",
        section.debitTotal,
        "",
        "Total",
        section.creditTotal,
      ]);
      body.push([]);
    }

    return this.toExportFile(
      report.startDate,
      report.endDate,
      format,
      header,
      body,
      report.message,
    );
  }

  private stubResponse(
    startDate: string,
    endDate: string,
    scope: FinalAccountReportScope,
    statementType: FinalAccountStatementType,
    mergeProfit: boolean,
  ) {
    return {
      startDate,
      endDate,
      scope,
      statementType,
      mergeProfit,
      message:
        "This statement type is not available yet. Select Trading to view the report.",
      debitColumns: DEBIT_COLUMNS.map((column) => ({ ...column })),
      creditColumns: CREDIT_COLUMNS.map((column) => ({ ...column })),
      sections: [] as TradingSection[],
    };
  }

  private emptyTradingResponse(
    startDate: string,
    endDate: string,
    scope: FinalAccountReportScope,
    mergeProfit: boolean,
    message: string,
  ) {
    return {
      startDate,
      endDate,
      scope,
      statementType: FinalAccountStatementType.TRADING,
      mergeProfit,
      message,
      debitColumns: DEBIT_COLUMNS.map((column) => ({ ...column })),
      creditColumns: CREDIT_COLUMNS.map((column) => ({ ...column })),
      sections: [] as TradingSection[],
    };
  }

  private async resolveTradingAccounts(): Promise<AccountMeta[]> {
    const [accounts, products] = await Promise.all([
      this.accountRepository
        .createQueryBuilder("account")
        .leftJoinAndSelect("account.financialCode", "financialCode")
        .leftJoinAndSelect("financialCode.financialType", "financialType")
        .where("account.active = true")
        .andWhere("account.deleted_at IS NULL")
        .orderBy("account.accountCode", "ASC")
        .getMany(),
      this.productRepository.find({
        relations: ["profitAc", "saleAc", "purchaseAc", "bulkSaleAc", "bulkProficAc"],
      }),
    ]);

    const productTradingAccountIds = new Set<string>();
    for (const product of products) {
      for (const account of [
        product.profitAc,
        product.saleAc,
        product.purchaseAc,
        product.bulkSaleAc,
        product.bulkProficAc,
      ]) {
        if (account?.id) productTradingAccountIds.add(account.id);
      }
    }

    const selected = new Map<string, AccountMeta>();
    for (const account of accounts) {
      const accountCode = toText(account.accountCode);
      const financialType = account.financialCode?.financialType;
      const tradingType = financialType
        ? isTradingType(
            toText(financialType.label),
            toText(financialType.value),
          )
        : false;
      // Include mis-tagged sale/purchase/profit ledgers (e.g. SALCN as Balance Sheet).
      if (
        !tradingType &&
        !productTradingAccountIds.has(account.id) &&
        !isTradingAccountCode(accountCode)
      ) {
        continue;
      }
      selected.set(account.id, {
        id: account.id,
        accountCode,
        accountName: toText(account.accountName),
      });
    }

    return Array.from(selected.values()).sort((left, right) =>
      left.accountCode.localeCompare(right.accountCode),
    );
  }

  private async resolveBranchMeta(branchIds: string[]) {
    const branches = await this.branchRepository.find({
      where: branchIds.length ? { id: In(branchIds) } : {},
    });
    return new Map(
      branches.map((branch) => [
        branch.id,
        {
          code: toText(branch.code) || branch.id,
          label: toText(branch.name) || toText(branch.code) || branch.id,
        },
      ]),
    );
  }

  private async collectAggregates(input: {
    accountIds: string[];
    branchIds: string[];
    startDate?: string;
    endDate?: string;
    beforeDate?: string;
  }) {
    if (!input.accountIds.length) {
      return [] as Array<{
        accountId: string;
        branchId: string;
        direction: string;
        amount: string | number;
      }>;
    }

    const params: unknown[] = [input.accountIds];
    const conditions = [
      "posting.deleted_at IS NULL",
      "tx.deleted_at IS NULL",
      "posting.account_id = ANY($1::uuid[])",
    ];

    if (input.branchIds.length) {
      params.push(input.branchIds);
      conditions.push(`tx.branch_id = ANY($${params.length}::uuid[])`);
    }

    // Calendar-date compare: transaction_date is timestamptz stored as UTC midnight.
    if (input.beforeDate) {
      params.push(input.beforeDate);
      conditions.push(
        `(tx.transaction_date AT TIME ZONE 'UTC')::date < $${params.length}::date`,
      );
    } else {
      if (input.startDate) {
        params.push(input.startDate);
        conditions.push(
          `(tx.transaction_date AT TIME ZONE 'UTC')::date >= $${params.length}::date`,
        );
      }
      if (input.endDate) {
        params.push(input.endDate);
        conditions.push(
          `(tx.transaction_date AT TIME ZONE 'UTC')::date <= $${params.length}::date`,
        );
      }
    }

    const rows = (await this.database2.query(
      `SELECT
          posting.account_id AS "accountId",
          tx.branch_id AS "branchId",
          posting.direction AS "direction",
          SUM(posting.amount) AS "amount",
          tx.slug AS "documentSlug"
        FROM transaction_account_postings posting
        INNER JOIN transactions tx ON tx.id = posting.transaction_id
        WHERE ${conditions.join(" AND ")}
        GROUP BY
          posting.account_id,
          tx.branch_id,
          posting.direction,
          tx.slug`,
      params,
    )) as Array<Record<string, unknown>>;

    return rows
      .filter(
        (row) => !TECHNICAL_SLUGS.includes(normalizeUpper(row.documentSlug)),
      )
      .map((row) => ({
        accountId: toText(row.accountId),
        branchId: toText(row.branchId),
        direction: toText(row.direction).toUpperCase(),
        amount: (row.amount as string | number) ?? 0,
      }));
  }

  private mergeBuckets(input: {
    scope: FinalAccountReportScope;
    openingRows: Array<{
      accountId: string;
      branchId: string;
      direction: string;
      amount: string | number;
    }>;
    periodRows: Array<{
      accountId: string;
      branchId: string;
      direction: string;
      amount: string | number;
    }>;
    branchMetaById: Map<string, { code: string; label: string }>;
  }) {
    const buckets = new Map<string, AggregateBucket>();
    const keyOf = (branchId: string | null, accountId: string) =>
      `${branchId ?? "ALL"}::${accountId}`;

    const ensure = (branchId: string | null, accountId: string) => {
      const key = keyOf(branchId, accountId);
      let bucket = buckets.get(key);
      if (!bucket) {
        const branchCode =
          branchId == null
            ? "ALL"
            : input.branchMetaById.get(branchId)?.code || branchId;
        bucket = {
          branchId,
          branchCode,
          accountId,
          openingCents: 0,
          periodDebitCents: 0,
          periodCreditCents: 0,
        };
        buckets.set(key, bucket);
      }
      return bucket;
    };

    const resolveBranchId = (branchId: string) =>
      input.scope === FinalAccountReportScope.CONSOLIDATED ? null : branchId;

    for (const row of input.openingRows) {
      const amountCents = cents(row.amount);
      if (amountCents <= 0) continue;
      const bucket = ensure(resolveBranchId(row.branchId), row.accountId);
      if (row.direction === TransactionPostingDirection.DEBIT) {
        bucket.openingCents += amountCents;
      } else {
        bucket.openingCents -= amountCents;
      }
    }

    for (const row of input.periodRows) {
      const amountCents = cents(row.amount);
      if (amountCents <= 0) continue;
      const bucket = ensure(resolveBranchId(row.branchId), row.accountId);
      if (row.direction === TransactionPostingDirection.DEBIT) {
        bucket.periodDebitCents += amountCents;
      } else {
        bucket.periodCreditCents += amountCents;
      }
    }

    return Array.from(buckets.values()).filter((bucket) => {
      const closing =
        bucket.openingCents +
        bucket.periodDebitCents -
        bucket.periodCreditCents;
      return (
        bucket.openingCents !== 0 ||
        bucket.periodDebitCents !== 0 ||
        bucket.periodCreditCents !== 0 ||
        closing !== 0
      );
    });
  }

  private buildTradingSections(input: {
    scope: FinalAccountReportScope;
    buckets: AggregateBucket[];
    accountById: Map<string, AccountMeta>;
  }): TradingSection[] {
    const byBranch = new Map<
      string,
      {
        branchId: string | null;
        branchLabel: string;
        debit: Array<{ code: string; name: string; amountCents: number }>;
        credit: Array<{ code: string; name: string; amountCents: number }>;
      }
    >();

    for (const bucket of input.buckets) {
      const account = input.accountById.get(bucket.accountId);
      if (!account) continue;
      // Trading statement is period-scoped: From/To must change line amounts.
      // Lifetime closing-as-of-endDate made most date presets look identical.
      const periodNetCents =
        bucket.periodDebitCents - bucket.periodCreditCents;
      if (periodNetCents === 0) continue;
      const branchKey = bucket.branchId ?? "ALL";
      let section = byBranch.get(branchKey);
      if (!section) {
        section = {
          branchId: bucket.branchId,
          branchLabel:
            input.scope === FinalAccountReportScope.CONSOLIDATED
              ? "ALL"
              : bucket.branchCode,
          debit: [],
          credit: [],
        };
        byBranch.set(branchKey, section);
      }

      const line = {
        code: account.accountCode,
        name: account.accountName,
        amountCents: Math.abs(periodNetCents),
      };
      if (periodNetCents >= 0) {
        section.debit.push(line);
      } else {
        section.credit.push(line);
      }
    }

    const sections = Array.from(byBranch.values())
      .map((section) => {
        section.debit.sort((left, right) => left.code.localeCompare(right.code));
        section.credit.sort((left, right) =>
          left.code.localeCompare(right.code),
        );

        let debitTotalCents = section.debit.reduce(
          (sum, row) => sum + row.amountCents,
          0,
        );
        let creditTotalCents = section.credit.reduce(
          (sum, row) => sum + row.amountCents,
          0,
        );

        if (creditTotalCents > debitTotalCents) {
          const profitCents = creditTotalCents - debitTotalCents;
          section.debit.push({
            code: "PL",
            name: "GROSS PROFIT",
            amountCents: profitCents,
          });
          debitTotalCents += profitCents;
        } else if (debitTotalCents > creditTotalCents) {
          const lossCents = debitTotalCents - creditTotalCents;
          section.credit.push({
            code: "PL",
            name: "GROSS LOSS",
            amountCents: lossCents,
          });
          creditTotalCents += lossCents;
        }

        const debitRows = section.debit.map((row) => ({
          code: row.code,
          name: row.name,
          amount: money(row.amountCents),
        }));
        const creditRows = section.credit.map((row) => ({
          code: row.code,
          name: row.name,
          amount: money(row.amountCents),
        }));

        const rowCount = Math.max(debitRows.length, creditRows.length);
        while (debitRows.length < rowCount) {
          debitRows.push(emptySideRow());
        }
        while (creditRows.length < rowCount) {
          creditRows.push(emptySideRow());
        }

        return {
          branchId: section.branchId,
          branchLabel: section.branchLabel,
          debitRows,
          creditRows,
          debitTotal: money(debitTotalCents),
          creditTotal: money(creditTotalCents),
        };
      })
      .filter(
        (section) =>
          section.debitRows.some((row) => row.code || row.name || row.amount) ||
          section.creditRows.some((row) => row.code || row.name || row.amount),
      )
      .sort((left, right) => left.branchLabel.localeCompare(right.branchLabel));

    return sections;
  }

  private toExportFile(
    startDate: string,
    endDate: string,
    format: CardSettlementReportFormat,
    header: string[],
    body: string[][],
    message: string,
  ) {
    const extension = format === CardSettlementReportFormat.CSV ? "csv" : "xlsx";
    const filename = `final-account-report-${startDate}-to-${endDate}.${extension}`;

    if (format === CardSettlementReportFormat.CSV) {
      const escape = (value: string) =>
        /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
      const csv =
        message && !body.length
          ? message
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
      message && !body.length ? [[message]] : [header, ...body],
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Final Account");
    return {
      filename,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer,
    };
  }
}
