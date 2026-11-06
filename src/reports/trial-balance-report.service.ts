import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import * as XLSX from "xlsx";
import { AccountProfile } from "../account-profiles/account-profile.entity";
import { SessionContext } from "../auth/types/session-context";
import { Branch } from "../branches/branch.entity";
import { TransactionPostingDirection } from "../transactions/transactions.enums";
import { UserRole } from "../user-roles/user-role.entity";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import {
  TrialBalanceReportQueryDto,
  TrialBalanceReportScope,
} from "./dto/trial-balance-report-query.dto";
import { resolveFlmAccessibleBranchIds } from "./flm-report-access.helpers";

type ReportColumn = { key: string; label: string };

type AccountMeta = {
  id: string;
  accountCode: string;
  accountName: string;
  financialTypeId: string;
  financialTypeLabel: string;
  financialTypeSort: number;
  financialCodeId: string;
  financialCode: string;
  financialName: string;
  financialCodePriority: number;
};

type AggregateKey = string;

type AggregateBucket = {
  branchId: string | null;
  branchCode: string;
  accountId: string;
  openingCents: number;
  periodDebitCents: number;
  periodCreditCents: number;
};

type TrialBalanceRow = {
  rowType: "BRANCH" | "TYPE" | "CODE" | "ACCOUNT" | "TOTAL";
  brnCode: string;
  code: string;
  name: string;
  openingDr: string;
  openingCr: string;
  transactionDebit: string;
  transactionCredit: string;
  closingDr: string;
  closingCr: string;
};

const COLUMNS: ReportColumn[] = [
  { key: "brnCode", label: "BRNCODE" },
  { key: "code", label: "Code" },
  { key: "name", label: "Name" },
  { key: "openingDr", label: "Opening DR" },
  { key: "openingCr", label: "Opening CR" },
  { key: "transactionDebit", label: "Transaction Debit" },
  { key: "transactionCredit", label: "Transaction Credit" },
  { key: "closingDr", label: "Closingbal Debit" },
  { key: "closingCr", label: "Closingbal Credit" },
];

const TECHNICAL_SLUGS = [
  "CARD_STOCK",
  "CARD_TRANSFER_OUT",
  "CARD_TRANSFER_IN",
  "CARD_STOCK_LOAD",
  "CARD_SELL",
  "CARD_SETTLE",
  "CM_SETTLE",
  "TT_SETTLE",
  "CARD_RETURN",
  "CARD_VOID",
];

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

const emptyAmounts = () => ({
  openingDr: "",
  openingCr: "",
  transactionDebit: "",
  transactionCredit: "",
  closingDr: "",
  closingCr: "",
});

const splitBalance = (netCents: number) => {
  if (netCents >= 0) {
    return { dr: money(netCents), cr: money(0) };
  }
  return { dr: money(0), cr: money(Math.abs(netCents)) };
};

const isNonZeroBucket = (bucket: AggregateBucket) => {
  const closing =
    bucket.openingCents + bucket.periodDebitCents - bucket.periodCreditCents;
  return (
    bucket.openingCents !== 0 ||
    bucket.periodDebitCents !== 0 ||
    bucket.periodCreditCents !== 0 ||
    closing !== 0
  );
};

@Injectable()
export class TrialBalanceReportService {
  constructor(
    @InjectDataSource("database2")
    private readonly database2: DataSource,
    @InjectRepository(AccountProfile)
    private readonly accountRepository: Repository<AccountProfile>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
  ) {}

  async buildReport(
    query: TrialBalanceReportQueryDto,
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

    const scope = query.scope ?? TrialBalanceReportScope.BRANCH;
    const groupBy = Boolean(query.groupBy);
    const branchIds = await resolveFlmAccessibleBranchIds(
      this.userRoleRepository,
      query.branchIds ?? [],
      session,
    );

    const accounts = await this.resolveAccounts();
    if (!accounts.length) {
      return this.emptyResponse(startDate, endDate, scope, groupBy);
    }

    const accountById = new Map(accounts.map((account) => [account.id, account]));
    const accountIds = accounts.map((account) => account.id);
    const branchMetaById = await this.resolveBranchMeta(branchIds);

    const [openingRows, periodRows] = await Promise.all([
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
    ]);

    const buckets = this.mergeBuckets({
      scope,
      openingRows,
      periodRows,
      branchMetaById,
    });

    const rows = this.buildRows({
      scope,
      groupBy,
      buckets,
      accountById,
      branchMetaById,
    });

    return {
      startDate,
      endDate,
      scope,
      groupBy,
      message: rows.length
        ? ""
        : "No trial balance rows for the selected filters.",
      columns: COLUMNS.map((column) => ({ ...column })),
      rows,
    };
  }

  async buildExport(
    query: TrialBalanceReportQueryDto,
    format: CardSettlementReportFormat,
    session?: SessionContext,
  ) {
    const report = await this.buildReport(query, session);
    const header = report.columns.map((column) => column.label);
    const body = report.rows.map((row) =>
      report.columns.map(
        (column) => row[column.key as keyof TrialBalanceRow] ?? "",
      ),
    );
    return this.toExportFile(
      report.startDate,
      report.endDate,
      format,
      header,
      body,
      report.message,
    );
  }

  private emptyResponse(
    startDate: string,
    endDate: string,
    scope: TrialBalanceReportScope,
    groupBy: boolean,
  ) {
    return {
      startDate,
      endDate,
      scope,
      groupBy,
      message: "No accounts available for the selected filters.",
      columns: COLUMNS.map((column) => ({ ...column })),
      rows: [] as TrialBalanceRow[],
    };
  }

  private async resolveAccounts(): Promise<AccountMeta[]> {
    const accounts = await this.accountRepository
      .createQueryBuilder("account")
      .leftJoinAndSelect("account.financialCode", "financialCode")
      .leftJoinAndSelect("financialCode.financialType", "financialType")
      .where("account.active = true")
      .andWhere("account.deleted_at IS NULL")
      .orderBy("account.accountCode", "ASC")
      .getMany();

    return accounts
      .filter((account) => Boolean(account.financialCode?.id))
      .map((account) => {
        const financialCode = account.financialCode;
        const financialType = financialCode.financialType;
        return {
          id: account.id,
          accountCode: toText(account.accountCode),
          accountName: toText(account.accountName),
          financialTypeId: financialType?.id || "UNASSIGNED",
          financialTypeLabel:
            toText(financialType?.label) ||
            toText(financialType?.value) ||
            "Unassigned",
          financialTypeSort: Number(financialType?.sortOrder ?? 0) || 0,
          financialCodeId: financialCode.id,
          financialCode: toText(financialCode.financialCode),
          financialName: toText(financialCode.financialName),
          financialCodePriority: Number(financialCode.priority ?? 0) || 0,
        };
      });
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
        documentSlug: string | null;
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

    if (input.beforeDate) {
      params.push(input.beforeDate);
      conditions.push(`tx.transaction_date < $${params.length}::date`);
    } else {
      if (input.startDate) {
        params.push(input.startDate);
        conditions.push(`tx.transaction_date >= $${params.length}::date`);
      }
      if (input.endDate) {
        params.push(input.endDate);
        conditions.push(`tx.transaction_date <= $${params.length}::date`);
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
        (row) =>
          !TECHNICAL_SLUGS.includes(normalizeUpper(row.documentSlug)),
      )
      .map((row) => ({
        accountId: toText(row.accountId),
        branchId: toText(row.branchId),
        direction: toText(row.direction).toUpperCase(),
        amount: (row.amount as string | number) ?? 0,
        documentSlug: toText(row.documentSlug) || null,
      }));
  }

  private mergeBuckets(input: {
    scope: TrialBalanceReportScope;
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
    const buckets = new Map<AggregateKey, AggregateBucket>();

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
      input.scope === TrialBalanceReportScope.CONSOLIDATED ? null : branchId;

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

    return Array.from(buckets.values()).filter(isNonZeroBucket);
  }

  private buildRows(input: {
    scope: TrialBalanceReportScope;
    groupBy: boolean;
    buckets: AggregateBucket[];
    accountById: Map<string, AccountMeta>;
    branchMetaById: Map<string, { code: string; label: string }>;
  }): TrialBalanceRow[] {
    const enriched = input.buckets
      .map((bucket) => {
        const account = input.accountById.get(bucket.accountId);
        if (!account) return null;
        const closingCents =
          bucket.openingCents +
          bucket.periodDebitCents -
          bucket.periodCreditCents;
        return { bucket, account, closingCents };
      })
      .filter(
        (
          item,
        ): item is {
          bucket: AggregateBucket;
          account: AccountMeta;
          closingCents: number;
        } => Boolean(item),
      );

    enriched.sort((left, right) => {
      const branchCompare = left.bucket.branchCode.localeCompare(
        right.bucket.branchCode,
      );
      if (branchCompare !== 0) return branchCompare;
      if (left.account.financialTypeSort !== right.account.financialTypeSort) {
        return left.account.financialTypeSort - right.account.financialTypeSort;
      }
      const typeCompare = left.account.financialTypeLabel.localeCompare(
        right.account.financialTypeLabel,
      );
      if (typeCompare !== 0) return typeCompare;
      if (
        left.account.financialCodePriority !==
        right.account.financialCodePriority
      ) {
        return (
          left.account.financialCodePriority -
          right.account.financialCodePriority
        );
      }
      const codeNameCompare = left.account.financialName.localeCompare(
        right.account.financialName,
      );
      if (codeNameCompare !== 0) return codeNameCompare;
      return left.account.accountCode.localeCompare(right.account.accountCode);
    });

    const rows: TrialBalanceRow[] = [];
    let currentBranchId: string | null | undefined;
    let currentTypeId = "";
    let currentCodeId = "";
    type RunningTotal = {
      openingCents: number;
      periodDebitCents: number;
      periodCreditCents: number;
      closingCents: number;
    };
    let codeTotal: RunningTotal | null = null;
    const reportTotal = input.groupBy
      ? null
      : ({
          openingCents: 0,
          periodDebitCents: 0,
          periodCreditCents: 0,
          closingCents: 0,
        } as RunningTotal);

    const pushTotalRow = (total: RunningTotal) => {
      const opening = splitBalance(total.openingCents);
      const closing = splitBalance(total.closingCents);
      rows.push({
        rowType: "TOTAL",
        brnCode: "",
        code: "",
        name: "Total",
        openingDr: opening.dr,
        openingCr: opening.cr,
        transactionDebit: money(total.periodDebitCents),
        transactionCredit: money(total.periodCreditCents),
        closingDr: closing.dr,
        closingCr: closing.cr,
      });
    };

    const emptyRunningTotal = (): RunningTotal => ({
      openingCents: 0,
      periodDebitCents: 0,
      periodCreditCents: 0,
      closingCents: 0,
    });

    const addToRunningTotal = (
      total: RunningTotal,
      bucket: AggregateBucket,
      closingCents: number,
    ) => {
      total.openingCents += bucket.openingCents;
      total.periodDebitCents += bucket.periodDebitCents;
      total.periodCreditCents += bucket.periodCreditCents;
      total.closingCents += closingCents;
    };

    const flushCodeTotal = () => {
      if (!codeTotal || !input.groupBy) {
        codeTotal = null;
        return;
      }
      pushTotalRow(codeTotal);
      codeTotal = null;
    };

    for (const item of enriched) {
      const { bucket, account, closingCents } = item;
      const branchChanged = currentBranchId !== bucket.branchId;
      if (branchChanged) {
        flushCodeTotal();
        currentBranchId = bucket.branchId;
        currentTypeId = "";
        currentCodeId = "";
        if (input.scope === TrialBalanceReportScope.BRANCH) {
          rows.push({
            rowType: "BRANCH",
            brnCode: bucket.branchCode,
            code: "",
            name: bucket.branchCode,
            ...emptyAmounts(),
          });
        }
      }

      if (input.groupBy) {
        if (currentTypeId !== account.financialTypeId) {
          flushCodeTotal();
          currentTypeId = account.financialTypeId;
          currentCodeId = "";
          rows.push({
            rowType: "TYPE",
            brnCode: "",
            code: account.financialTypeLabel,
            name: "",
            ...emptyAmounts(),
          });
        }

        if (currentCodeId !== account.financialCodeId) {
          flushCodeTotal();
          currentCodeId = account.financialCodeId;
          codeTotal = emptyRunningTotal();
          rows.push({
            rowType: "CODE",
            brnCode: "",
            code: "",
            name: account.financialName || account.financialCode,
            ...emptyAmounts(),
          });
        }

        if (codeTotal) {
          addToRunningTotal(codeTotal, bucket, closingCents);
        }
      } else if (reportTotal) {
        addToRunningTotal(reportTotal, bucket, closingCents);
      }

      const opening = splitBalance(bucket.openingCents);
      const closing = splitBalance(closingCents);
      rows.push({
        rowType: "ACCOUNT",
        brnCode:
          input.scope === TrialBalanceReportScope.CONSOLIDATED
            ? "ALL"
            : bucket.branchCode,
        code: account.accountCode,
        name: account.accountName,
        openingDr: opening.dr,
        openingCr: opening.cr,
        transactionDebit: money(bucket.periodDebitCents),
        transactionCredit: money(bucket.periodCreditCents),
        closingDr: closing.dr,
        closingCr: closing.cr,
      });
    }

    flushCodeTotal();
    if (reportTotal) {
      pushTotalRow(reportTotal);
    }
    return rows;
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
    const filename = `trial-balance-report-${startDate}-to-${endDate}.${extension}`;

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
    XLSX.utils.book_append_sheet(workbook, sheet, "Trial Balance");
    return {
      filename,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer,
    };
  }
}
