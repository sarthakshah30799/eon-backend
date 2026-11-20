import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import * as XLSX from "xlsx";
import { AccountProfile } from "../account-profiles/account-profile.entity";
import { AccountProfileBranch } from "../account-profiles/entities/account-profile-branch.entity";
import { SessionContext } from "../auth/types/session-context";
import { Branch } from "../branches/branch.entity";
import { TransactionPayment } from "../transactions/entities/transaction-payment.entity";
import { TransactionStatus } from "../transactions/transactions.enums";
import { UserRole } from "../user-roles/user-role.entity";
import { AccountingVoucher } from "../vouchers/entities";
import {
  VoucherEntryDirection,
  VoucherType,
} from "../vouchers/voucher.enums";
import {
  CashReportFormat,
  CashReportLayout,
  CashReportQueryDto,
  CashReportScope,
} from "./dto/cash-report-query.dto";
import { resolveFlmAccessibleBranchIds } from "./flm-report-access.helpers";

type ReportColumn = { key: string; label: string };

type Movement = {
  branchId: string;
  branchLabel: string;
  accountId: string;
  accountLabel: string;
  transactionDate: string;
  createdAt: string;
  number: string;
  party: string;
  narration: string;
  receiptsCents: number;
  paymentsCents: number;
  isReceipt: boolean;
  typeCode: string;
  transactionLabel: string;
};

type ReportRow = {
  transactionType: string;
  date: string;
  type: string;
  number: string;
  party: string;
  narration: string;
  receipts: string;
  payments: string;
  runningBalance: string;
};

type AccountSection = {
  accountId: string;
  accountLabel: string;
  openingBalance: string;
  totalReceipts: string;
  totalPayments: string;
  closingBalance: string;
  rows: ReportRow[];
};

type BranchBlock = {
  branchId: string | null;
  branchLabel: string;
  accounts: AccountSection[];
  summary: {
    openingBalance: string;
    totalReceipts: string;
    totalPayments: string;
    closingBalance: string;
  };
};

type ColumnarRow = {
  accountId: string;
  code: string;
  values: Record<string, string>;
};

const COLUMNS: ReportColumn[] = [
  { key: "transactionType", label: "Transaction" },
  { key: "date", label: "Date" },
  { key: "type", label: "Type" },
  { key: "number", label: "No" },
  { key: "party", label: "Party" },
  { key: "narration", label: "Narration" },
  { key: "receipts", label: "Receipts" },
  { key: "payments", label: "Payments" },
  { key: "runningBalance", label: "Running Bal." },
];

const toText = (value: unknown) => String(value ?? "").trim();

const normalizeUpper = (value: unknown) =>
  toText(value)
    .replace(/[\s-]+/g, "_")
    .toUpperCase();

const isCashLedgerAccount = (account: AccountProfile) => {
  const tokens = [account.accountType?.value, account.accountType?.label].map(
    normalizeUpper,
  );
  return tokens.includes("CASH_LEDGER");
};

const money = (cents: number) => (cents / 100).toFixed(2);

const balanceLabel = (cents: number) => {
  const abs = money(Math.abs(cents));
  if (cents < 0) return `${abs} Cr.`;
  return `${abs} Dr.`;
};

const cents = (value: unknown) => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100);
};

const toDateOnly = (value: unknown) => {
  const raw = toText(value);
  return raw ? raw.slice(0, 10) : "";
};

const getSnapshotLabel = (
  snapshot: Record<string, unknown> | null | undefined,
) => {
  if (!snapshot) return "";
  const code = toText(snapshot.code ?? snapshot.accountCode);
  const name = toText(
    snapshot.name ?? snapshot.label ?? snapshot.accountName,
  );
  if (code && name) return `${code} - ${name}`;
  return name || code;
};

const getPassengerName = (
  snapshot: Record<string, unknown> | null | undefined,
) => {
  if (!snapshot) return "";
  const candidates = [
    snapshot.panHolderName,
    snapshot.name,
    snapshot.fullName,
    snapshot.passengerName,
    snapshot.label,
  ];
  for (const candidate of candidates) {
    const value = toText(candidate);
    if (value) return value;
  }
  return "";
};

const isIndividualParty = (
  snapshot: Record<string, unknown> | null | undefined,
) => {
  if (!snapshot) return false;
  if (snapshot.isIndividual === true) return true;
  const entity = snapshot.entityType as Record<string, unknown> | undefined;
  const tokens = [entity?.value, entity?.label, snapshot.entityType].map(
    normalizeUpper,
  );
  return tokens.some((token) => token === "INDIVIDUAL");
};

@Injectable()
export class CashReportService {
  constructor(
    @InjectRepository(AccountProfile)
    private readonly accountRepository: Repository<AccountProfile>,
    @InjectRepository(AccountProfileBranch)
    private readonly accountBranchRepository: Repository<AccountProfileBranch>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectRepository(AccountingVoucher, "database2")
    private readonly voucherRepository: Repository<AccountingVoucher>,
    @InjectRepository(TransactionPayment, "database2")
    private readonly paymentRepository: Repository<TransactionPayment>,
  ) {}

  async buildReport(
    query: CashReportQueryDto,
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

    const layout = query.layout ?? CashReportLayout.LEDGER;
    const scope =
      layout === CashReportLayout.COLUMNAR
        ? CashReportScope.BRANCH
        : (query.scope ?? CashReportScope.BRANCH);
    const branchIds = await resolveFlmAccessibleBranchIds(
      this.userRoleRepository,
      query.branchIds ?? [],
      session,
    );
    const counterIds = (query.counterIds ?? []).filter(Boolean);

    const cashAccounts = await this.resolveCashAccounts(
      branchIds,
      query.accountIds,
    );
    if (!cashAccounts.length) {
      return {
        startDate,
        endDate,
        scope,
        layout,
        message:
          "No cash ledger accounts linked to the selected branches for the selected filters.",
        columns: COLUMNS.map((column) => ({ ...column })),
        branches: [] as BranchBlock[],
        rows: [] as ColumnarRow[],
      };
    }

    const cashIds = cashAccounts.map((account) => account.id);
    const accountLabelById = new Map(
      cashAccounts.map((account) => [
        account.id,
        `${account.accountCode} - ${account.accountName}`,
      ]),
    );
    const branchLabelById = await this.resolveBranchLabels(branchIds);

    const [openingMovements, rangeMovements] = await Promise.all([
      this.collectMovements({
        cashIds,
        accountLabelById,
        branchIds,
        counterIds,
        branchLabelById,
        beforeDate: startDate,
      }),
      this.collectMovements({
        cashIds,
        accountLabelById,
        branchIds,
        counterIds,
        branchLabelById,
        startDate,
        endDate,
      }),
    ]);

    if (layout === CashReportLayout.COLUMNAR) {
      const columnar = this.buildColumnar({
        cashAccounts,
        openingMovements,
        rangeMovements,
        branchLabelById,
        branchIds,
      });
      return {
        startDate,
        endDate,
        scope,
        layout,
        message: columnar.rows.length
          ? ""
          : "No cash ledger balances found for the selected filters.",
        columns: columnar.columns,
        branches: [] as BranchBlock[],
        rows: columnar.rows,
      };
    }

    const branches = this.buildBranches({
      scope,
      cashAccounts,
      openingMovements,
      rangeMovements,
      branchLabelById,
    });

    return {
      startDate,
      endDate,
      scope,
      layout,
      message: branches.length
        ? ""
        : "No cash ledger movements found for the selected filters.",
      columns: COLUMNS.map((column) => ({ ...column })),
      branches,
      rows: [] as ColumnarRow[],
    };
  }

  async buildExport(
    query: CashReportQueryDto,
    format: CashReportFormat,
    session?: SessionContext,
  ) {
    const report = await this.buildReport(query, session);
    const exportRows: Array<Record<string, string>> = [];

    if (report.layout === CashReportLayout.COLUMNAR) {
      for (const row of report.rows) {
        const exportRow: Record<string, string> = { Code: row.code };
        for (const column of report.columns) {
          if (column.key === "code") continue;
          exportRow[column.label] = row.values[column.key] ?? "0.00";
        }
        exportRows.push(exportRow);
      }
    } else {
      for (const branch of report.branches) {
        for (const account of branch.accounts) {
          const section = `${branch.branchLabel} | ${account.accountLabel}`;
          for (const row of account.rows) {
            exportRows.push({
              Section: section,
              Transaction: row.transactionType,
              Date: row.date,
              Type: row.type,
              No: row.number,
              Party: row.party,
              Narration: row.narration,
              Receipts: row.receipts,
              Payments: row.payments,
              "Running Bal.": row.runningBalance,
            });
          }
        }
        exportRows.push({
          Section: `${branch.branchLabel} | Summary of Cash`,
          Transaction: "Opening Balance",
          Date: "",
          Type: "",
          No: "",
          Party: "",
          Narration: "",
          Receipts: "",
          Payments: "",
          "Running Bal.": branch.summary.openingBalance,
        });
        exportRows.push({
          Section: `${branch.branchLabel} | Summary of Cash`,
          Transaction: "Total Receipts",
          Date: "",
          Type: "",
          No: "",
          Party: "",
          Narration: "",
          Receipts: branch.summary.totalReceipts,
          Payments: "",
          "Running Bal.": "",
        });
        exportRows.push({
          Section: `${branch.branchLabel} | Summary of Cash`,
          Transaction: "Total Payment",
          Date: "",
          Type: "",
          No: "",
          Party: "",
          Narration: "",
          Receipts: "",
          Payments: branch.summary.totalPayments,
          "Running Bal.": "",
        });
        exportRows.push({
          Section: `${branch.branchLabel} | Summary of Cash`,
          Transaction: "Closing Balance",
          Date: "",
          Type: "",
          No: "",
          Party: "",
          Narration: "",
          Receipts: "",
          Payments: "",
          "Running Bal.": branch.summary.closingBalance,
        });
      }
    }

    const worksheet = XLSX.utils.json_to_sheet(
      exportRows.length
        ? exportRows
        : [{ Message: report.message || "No data" }],
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Cash Report");

    const filename = `cash-report-${report.startDate}-to-${report.endDate}.${
      format === CashReportFormat.CSV ? "csv" : "xlsx"
    }`;

    if (format === CashReportFormat.CSV) {
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

  private async resolveCashAccounts(
    branchIds: string[],
    accountIds?: string[],
  ) {
    const accounts = await this.accountRepository.find({
      where: { active: true },
      relations: ["accountType", "branchLinks"],
    });
    let cashAccounts = accounts.filter(isCashLedgerAccount);

    if (branchIds.length) {
      const links = await this.accountBranchRepository.find({
        where: { branchId: In(branchIds) },
        select: ["accountProfileId", "branchId"],
      });
      const linkedAccountIds = new Set(
        links.map((link) => link.accountProfileId),
      );
      cashAccounts = cashAccounts.filter((account) => {
        const hasLinks = (account.branchLinks ?? []).length > 0;
        if (!hasLinks) return true; // global cash accounts
        return linkedAccountIds.has(account.id);
      });
    }

    if (accountIds?.length) {
      const selected = new Set(accountIds);
      cashAccounts = cashAccounts.filter((account) => selected.has(account.id));
    }

    return cashAccounts;
  }

  private async resolveBranchLabels(branchIds: string[]) {
    const branches = await this.branchRepository.find({
      where: branchIds.length ? { id: In(branchIds) } : {},
    });
    return new Map(
      branches.map((branch) => [
        branch.id,
        toText(branch.code) || toText(branch.name) || branch.id,
      ]),
    );
  }

  private async collectMovements(input: {
    cashIds: string[];
    accountLabelById: Map<string, string>;
    branchIds: string[];
    counterIds: string[];
    branchLabelById: Map<string, string>;
    startDate?: string;
    endDate?: string;
    beforeDate?: string;
  }) {
    const [voucherMovements, paymentMovements] = await Promise.all([
      this.collectVoucherMovements(input),
      this.collectPaymentMovements(input),
    ]);
    return [...voucherMovements, ...paymentMovements].sort((left, right) => {
      const dateCompare = left.transactionDate.localeCompare(
        right.transactionDate,
      );
      if (dateCompare !== 0) return dateCompare;
      return left.createdAt.localeCompare(right.createdAt);
    });
  }

  private async collectVoucherMovements(input: {
    cashIds: string[];
    accountLabelById: Map<string, string>;
    branchIds: string[];
    counterIds: string[];
    branchLabelById: Map<string, string>;
    startDate?: string;
    endDate?: string;
    beforeDate?: string;
  }) {
    const qb = this.voucherRepository
      .createQueryBuilder("voucher")
      .leftJoinAndSelect("voucher.items", "items")
      .where("voucher.voucherType IN (:...types)", {
        types: [
          VoucherType.RECEIPT,
          VoucherType.PAYMENT,
          VoucherType.DEPOSIT_WITHDRAWAL,
        ],
      });

    if (input.branchIds.length) {
      qb.andWhere("voucher.branchId IN (:...branchIds)", {
        branchIds: input.branchIds,
      });
    }
    if (input.counterIds.length) {
      qb.andWhere("voucher.counterId IN (:...counterIds)", {
        counterIds: input.counterIds,
      });
    }
    if (input.beforeDate) {
      qb.andWhere("voucher.transactionDate < :beforeDate", {
        beforeDate: input.beforeDate,
      });
    } else {
      qb.andWhere("voucher.transactionDate >= :startDate", {
        startDate: input.startDate,
      }).andWhere("voucher.transactionDate <= :endDate", {
        endDate: input.endDate,
      });
    }

    const vouchers = await qb.getMany();
    const cashIdSet = new Set(input.cashIds);
    const movements: Movement[] = [];

    for (const voucher of vouchers) {
      const branchLabel =
        input.branchLabelById.get(voucher.branchId) ||
        getSnapshotLabel(voucher.branchSnapshot as Record<string, unknown>) ||
        voucher.branchId;
      if (!input.branchLabelById.has(voucher.branchId)) {
        input.branchLabelById.set(voucher.branchId, branchLabel);
      }

      const partyLabel = getSnapshotLabel(
        voucher.partyProfileSnapshot as Record<string, unknown>,
      );
      const createdAt =
        voucher.createdAt instanceof Date
          ? voucher.createdAt.toISOString()
          : toText(voucher.createdAt);
      const transactionDate = toDateOnly(voucher.transactionDate);

      if (
        voucher.voucherType === VoucherType.RECEIPT ||
        voucher.voucherType === VoucherType.PAYMENT
      ) {
        if (!cashIdSet.has(voucher.headerAccountId ?? "")) continue;
        const amountCents = cents(voucher.finalAmount);
        if (amountCents <= 0) continue;
        const isReceipt = voucher.voucherType === VoucherType.RECEIPT;
        movements.push({
          branchId: voucher.branchId,
          branchLabel,
          accountId: voucher.headerAccountId!,
          accountLabel:
            input.accountLabelById.get(voucher.headerAccountId!) ||
            getSnapshotLabel(
              voucher.headerAccountSnapshot as Record<string, unknown>,
            ),
          transactionDate,
          createdAt,
          number: voucher.number,
          party: partyLabel || "-",
          narration: toText(voucher.narration),
          receiptsCents: isReceipt ? amountCents : 0,
          paymentsCents: isReceipt ? 0 : amountCents,
          isReceipt,
          typeCode: isReceipt ? "CI" : "CO",
          transactionLabel: isReceipt ? "Receipt" : "Payment",
        });
        continue;
      }

      for (const item of voucher.items ?? []) {
        if (!cashIdSet.has(item.accountId)) continue;
        const amountCents = cents(item.amount);
        if (amountCents <= 0) continue;
        const isReceipt = item.direction === VoucherEntryDirection.DEBIT;
        movements.push({
          branchId: voucher.branchId,
          branchLabel,
          accountId: item.accountId,
          accountLabel:
            input.accountLabelById.get(item.accountId) ||
            getSnapshotLabel(
              item.accountSnapshot as Record<string, unknown>,
            ),
          transactionDate,
          createdAt,
          number: voucher.number,
          party: partyLabel || "-",
          narration: toText(voucher.narration),
          receiptsCents: isReceipt ? amountCents : 0,
          paymentsCents: isReceipt ? 0 : amountCents,
          isReceipt,
          typeCode: "DW",
          transactionLabel: "Deposit Withdrawals",
        });
      }
    }

    return movements;
  }

  private async collectPaymentMovements(input: {
    cashIds: string[];
    accountLabelById: Map<string, string>;
    branchIds: string[];
    counterIds: string[];
    branchLabelById: Map<string, string>;
    startDate?: string;
    endDate?: string;
    beforeDate?: string;
  }) {
    const qb = this.paymentRepository
      .createQueryBuilder("payment")
      .innerJoinAndSelect("payment.transaction", "tx")
      .where("tx.status = :status", { status: TransactionStatus.APPROVED })
      .andWhere("tx.isLatest = true")
      .andWhere("payment.accountId IN (:...cashIds)", {
        cashIds: input.cashIds,
      });

    if (input.branchIds.length) {
      qb.andWhere("tx.branchId IN (:...branchIds)", {
        branchIds: input.branchIds,
      });
    }
    if (input.counterIds.length) {
      qb.andWhere("tx.counterId IN (:...counterIds)", {
        counterIds: input.counterIds,
      });
    }
    if (input.beforeDate) {
      qb.andWhere("tx.transactionDate < :beforeDate", {
        beforeDate: input.beforeDate,
      });
    } else {
      qb.andWhere("tx.transactionDate >= :startDate", {
        startDate: input.startDate,
      }).andWhere("tx.transactionDate <= :endDate", {
        endDate: input.endDate,
      });
    }

    const payments = await qb.getMany();
    const movements: Movement[] = [];

    for (const payment of payments) {
      const tx = payment.transaction;
      if (!tx) continue;
      const amountCents = cents(payment.amount);
      if (amountCents <= 0) continue;

      const branchLabel =
        input.branchLabelById.get(tx.branchId) ||
        getSnapshotLabel(tx.branchSnapshot as Record<string, unknown>) ||
        tx.branchId;
      if (!input.branchLabelById.has(tx.branchId)) {
        input.branchLabelById.set(tx.branchId, branchLabel);
      }

      const partySnapshot = tx.partyProfileSnapshot as Record<
        string,
        unknown
      > | null;
      const passengerSnapshot = tx.passengerSnapshot as Record<
        string,
        unknown
      > | null;
      const partyLabel = isIndividualParty(partySnapshot)
        ? getPassengerName(passengerSnapshot) ||
          getSnapshotLabel(partySnapshot) ||
          "-"
        : getSnapshotLabel(partySnapshot) || "-";

      const isReceipt = normalizeUpper(payment.paymentDirection) === "RECEIPT";
      const createdAt =
        payment.createdAt instanceof Date
          ? payment.createdAt.toISOString()
          : toText(payment.createdAt);

      movements.push({
        branchId: tx.branchId,
        branchLabel,
        accountId: payment.accountId,
        accountLabel:
          input.accountLabelById.get(payment.accountId) ||
          getSnapshotLabel(
            payment.accountSnapshot as Record<string, unknown>,
          ),
        transactionDate: toDateOnly(tx.transactionDate),
        createdAt,
        number: toText(tx.number),
        party: partyLabel,
        narration: toText(payment.remarks) || toText(tx.remarks) || "",
        receiptsCents: isReceipt ? amountCents : 0,
        paymentsCents: isReceipt ? 0 : amountCents,
        isReceipt,
        typeCode: isReceipt ? "CI" : "CO",
        transactionLabel: isReceipt ? "Receipt" : "Payment",
      });
    }

    return movements;
  }

  private buildColumnar(input: {
    cashAccounts: AccountProfile[];
    openingMovements: Movement[];
    rangeMovements: Movement[];
    branchLabelById: Map<string, string>;
    branchIds: string[];
  }) {
    const branchIds = (
      input.branchIds.length
        ? input.branchIds
        : Array.from(input.branchLabelById.keys())
    ).filter(Boolean);

    const sortedBranches = branchIds
      .map((id) => ({
        id,
        label: input.branchLabelById.get(id) || id,
      }))
      .sort((left, right) => left.label.localeCompare(right.label));

    const closingByKey = new Map<string, number>();
    const applyMovement = (movement: Movement) => {
      const key = `${movement.branchId}::${movement.accountId}`;
      closingByKey.set(
        key,
        (closingByKey.get(key) ?? 0) +
          movement.receiptsCents -
          movement.paymentsCents,
      );
    };
    input.openingMovements.forEach(applyMovement);
    input.rangeMovements.forEach(applyMovement);

    const columns: ReportColumn[] = [
      { key: "code", label: "Code" },
      ...sortedBranches.map((branch) => ({
        key: branch.id,
        label: branch.label,
      })),
    ];

    const rows: ColumnarRow[] = [...input.cashAccounts]
      .sort((left, right) =>
        toText(left.accountCode).localeCompare(toText(right.accountCode)),
      )
      .map((account) => {
        const values: Record<string, string> = {};
        for (const branch of sortedBranches) {
          const amountCents =
            closingByKey.get(`${branch.id}::${account.id}`) ?? 0;
          values[branch.id] = money(amountCents);
        }
        return {
          accountId: account.id,
          code: toText(account.accountCode) || account.id,
          values,
        };
      });

    return { columns, rows };
  }

  private buildBranches(input: {
    scope: CashReportScope;
    cashAccounts: AccountProfile[];
    openingMovements: Movement[];
    rangeMovements: Movement[];
    branchLabelById: Map<string, string>;
  }): BranchBlock[] {
    const isBranchScope = input.scope === CashReportScope.BRANCH;

    const openingByKey = new Map<string, number>();
    for (const movement of input.openingMovements) {
      const key = isBranchScope
        ? `${movement.branchId}::${movement.accountId}`
        : movement.accountId;
      openingByKey.set(
        key,
        (openingByKey.get(key) ?? 0) +
          movement.receiptsCents -
          movement.paymentsCents,
      );
    }

    type AccSection = {
      branchId: string | null;
      branchLabel: string;
      accountId: string;
      accountLabel: string;
      openingCents: number;
      movements: Movement[];
    };

    const sectionMap = new Map<string, AccSection>();
    const ensure = (
      branchId: string | null,
      branchLabel: string,
      accountId: string,
      accountLabel: string,
    ) => {
      const key = isBranchScope ? `${branchId}::${accountId}` : accountId;
      let section = sectionMap.get(key);
      if (!section) {
        section = {
          branchId,
          branchLabel,
          accountId,
          accountLabel,
          openingCents: openingByKey.get(key) ?? 0,
          movements: [],
        };
        sectionMap.set(key, section);
      }
      return section;
    };

    if (!isBranchScope) {
      for (const account of input.cashAccounts) {
        ensure(
          null,
          "ALL",
          account.id,
          `${account.accountCode} - ${account.accountName}`,
        );
      }
    }

    for (const movement of input.rangeMovements) {
      ensure(
        isBranchScope ? movement.branchId : null,
        isBranchScope ? movement.branchLabel : "ALL",
        movement.accountId,
        movement.accountLabel,
      ).movements.push(movement);
    }

    if (isBranchScope) {
      for (const [key, openingCents] of openingByKey.entries()) {
        if (sectionMap.has(key)) continue;
        const [branchId, accountId] = key.split("::");
        const account = input.cashAccounts.find((item) => item.id === accountId);
        if (!account) continue;
        ensure(
          branchId,
          input.branchLabelById.get(branchId) || branchId,
          accountId,
          `${account.accountCode} - ${account.accountName}`,
        ).openingCents = openingCents;
      }
    }

    const accountSections = Array.from(sectionMap.values())
      .map((section) => {
        let running = section.openingCents;
        let totalReceiptsCents = 0;
        let totalPaymentsCents = 0;
        const rows: ReportRow[] = [
          {
            transactionType: "Opening Balance",
            date: "",
            type: "OP",
            number: "",
            party: "",
            narration: "",
            receipts: "",
            payments: "",
            runningBalance: balanceLabel(running),
          },
        ];

        for (const movement of section.movements) {
          totalReceiptsCents += movement.receiptsCents;
          totalPaymentsCents += movement.paymentsCents;
          running += movement.receiptsCents - movement.paymentsCents;
          rows.push({
            transactionType: movement.transactionLabel,
            date: movement.transactionDate,
            type: movement.typeCode,
            number: movement.number,
            party: movement.party,
            narration: movement.narration,
            receipts: movement.receiptsCents
              ? money(movement.receiptsCents)
              : "",
            payments: movement.paymentsCents
              ? money(movement.paymentsCents)
              : "",
            runningBalance: balanceLabel(running),
          });
        }

        rows.push({
          transactionType: "Closing Balance",
          date: "",
          type: "CL",
          number: "",
          party: "",
          narration: "",
          receipts: "",
          payments: "",
          runningBalance: balanceLabel(running),
        });

        const hasActivity =
          section.openingCents !== 0 ||
          totalReceiptsCents !== 0 ||
          totalPaymentsCents !== 0 ||
          section.movements.length > 0;

        return {
          branchId: section.branchId,
          branchLabel: section.branchLabel,
          accountId: section.accountId,
          accountLabel: section.accountLabel,
          openingCents: section.openingCents,
          totalReceiptsCents,
          totalPaymentsCents,
          closingCents: running,
          rows,
          hasActivity,
        };
      })
      .filter((section) => section.hasActivity)
      .sort((left, right) => {
        const branchCompare = left.branchLabel.localeCompare(right.branchLabel);
        if (branchCompare !== 0) return branchCompare;
        return left.accountLabel.localeCompare(right.accountLabel);
      });

    const byBranch = new Map<string, typeof accountSections>();
    for (const section of accountSections) {
      const key = section.branchId ?? "ALL";
      const list = byBranch.get(key) ?? [];
      list.push(section);
      byBranch.set(key, list);
    }

    return Array.from(byBranch.entries())
      .map(([, sections]) => {
        const openingCents = sections.reduce(
          (sum, section) => sum + section.openingCents,
          0,
        );
        const totalReceiptsCents = sections.reduce(
          (sum, section) => sum + section.totalReceiptsCents,
          0,
        );
        const totalPaymentsCents = sections.reduce(
          (sum, section) => sum + section.totalPaymentsCents,
          0,
        );
        const closingCents = sections.reduce(
          (sum, section) => sum + section.closingCents,
          0,
        );
        return {
          branchId: sections[0]?.branchId ?? null,
          branchLabel: sections[0]?.branchLabel ?? "ALL",
          accounts: sections.map((section) => ({
            accountId: section.accountId,
            accountLabel: section.accountLabel,
            openingBalance: money(section.openingCents),
            totalReceipts: money(section.totalReceiptsCents),
            totalPayments: money(section.totalPaymentsCents),
            closingBalance: money(section.closingCents),
            rows: section.rows,
          })),
          summary: {
            openingBalance: money(openingCents),
            totalReceipts: money(totalReceiptsCents),
            totalPayments: money(totalPaymentsCents),
            closingBalance: money(closingCents),
          },
        };
      })
      .sort((left, right) => left.branchLabel.localeCompare(right.branchLabel));
  }
}
