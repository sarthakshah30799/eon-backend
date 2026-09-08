import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import * as XLSX from "xlsx";
import { AccountProfile } from "../account-profiles/account-profile.entity";
import { Branch } from "../branches/branch.entity";
import { TransactionStatus } from "../transactions/transactions.enums";
import { Transaction } from "../transactions/entities/transaction.entity";
import { TransactionPayment } from "../transactions/entities/transaction-payment.entity";
import {
  AccountingVoucher,
} from "../vouchers/entities";
import {
  VoucherEntryDirection,
  VoucherType,
} from "../vouchers/voucher.enums";
import {
  BankReportFormat,
  BankReportLayout,
  BankReportQueryDto,
} from "./dto/bank-report-query.dto";

type ReportColumn = { key: string; label: string };

type Movement = {
  branchId: string;
  branchLabel: string;
  accountId: string;
  accountLabel: string;
  transactionDate: string;
  createdAt: string;
  number: string;
  chequeNumber: string;
  chequeDate: string;
  party: string;
  narration: string;
  receiptsCents: number;
  paymentsCents: number;
  isReceipt: boolean;
};

type ReportRow = {
  transactionType: string;
  date: string;
  createdAt: string;
  number: string;
  chequeNumber: string;
  chequeDate: string;
  party: string;
  narration: string;
  receipts: string;
  payments: string;
  runningBalance: string;
};

type ReportSection = {
  branchId: string | null;
  branchLabel: string;
  accountId: string;
  accountLabel: string;
  openingBalance: string;
  totalReceipts: string;
  totalPayments: string;
  closingBalance: string;
  rows: ReportRow[];
};

const COLUMNS: ReportColumn[] = [
  { key: "transactionType", label: "Transaction" },
  { key: "date", label: "Date" },
  { key: "createdAt", label: "Created At" },
  { key: "number", label: "Number" },
  { key: "chequeNumber", label: "Cheque Number" },
  { key: "chequeDate", label: "Cheque Date" },
  { key: "party", label: "Party" },
  { key: "narration", label: "Narration" },
  { key: "receipts", label: "Receipts" },
  { key: "payments", label: "Payments" },
  { key: "runningBalance", label: "Running Balance" },
];

const toText = (value: unknown) => String(value ?? "").trim();

const normalizeUpper = (value: unknown) =>
  toText(value)
    .replace(/[\s-]+/g, "_")
    .toUpperCase();

const isBankLedgerAccount = (account: AccountProfile) => {
  const tokens = [
    account.accountType?.value,
    account.accountType?.label,
  ].map(normalizeUpper);
  return tokens.includes("BANK_LEDGER");
};

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

const getSnapshotLabel = (
  snapshot: Record<string, unknown> | null | undefined,
) => {
  if (!snapshot) return "";
  const code = toText(snapshot.code);
  const name = toText(snapshot.name ?? snapshot.label);
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
export class BankReportService {
  constructor(
    @InjectRepository(AccountProfile)
    private readonly accountRepository: Repository<AccountProfile>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(AccountingVoucher, "database2")
    private readonly voucherRepository: Repository<AccountingVoucher>,
    @InjectRepository(TransactionPayment, "database2")
    private readonly paymentRepository: Repository<TransactionPayment>,
  ) {}

  async buildReport(query: BankReportQueryDto) {
    const startDate = toDateOnly(query.startDate);
    const endDate = toDateOnly(query.endDate);
    if (!startDate || !endDate)
      throw new BadRequestException("Start date and end date are required");
    if (startDate > endDate)
      throw new BadRequestException("Start date cannot be after end date");

    const layout = query.layout ?? BankReportLayout.BRANCH_WISE;
    const bankAccounts = await this.resolveBankAccounts(query.accountIds);
    if (!bankAccounts.length) {
      return { columns: COLUMNS, layout, sections: [] as ReportSection[] };
    }

    const bankIds = bankAccounts.map((account) => account.id);
    const accountLabelById = new Map(
      bankAccounts.map((account) => [
        account.id,
        `${account.accountCode} - ${account.accountName}`,
      ]),
    );
    const branchIds = (query.branchIds ?? []).filter(Boolean);
    const branchLabelById = await this.resolveBranchLabels(branchIds);

    const [openingMovements, rangeMovements] = await Promise.all([
      this.collectMovements({
        bankIds,
        accountLabelById,
        branchIds,
        branchLabelById,
        beforeDate: startDate,
      }),
      this.collectMovements({
        bankIds,
        accountLabelById,
        branchIds,
        branchLabelById,
        startDate,
        endDate,
      }),
    ]);

    const sections = this.buildSections(
      layout,
      bankAccounts,
      openingMovements,
      rangeMovements,
      branchLabelById,
    );

    return { columns: COLUMNS, layout, sections };
  }

  async buildExport(query: BankReportQueryDto, format: BankReportFormat) {
    const report = await this.buildReport(query);
    const exportRows = report.sections.flatMap((section) => {
      const header =
        report.layout === BankReportLayout.BRANCH_WISE
          ? `${section.branchLabel} | ${section.accountLabel}`
          : section.accountLabel;
      return [
        ...section.rows.map((row) => ({
          Section: header,
          Transaction: row.transactionType,
          Date: row.date,
          "Created At": row.createdAt,
          Number: row.number,
          "Cheque Number": row.chequeNumber,
          "Cheque Date": row.chequeDate,
          Party: row.party,
          Narration: row.narration,
          Receipts: row.receipts,
          Payments: row.payments,
          "Running Balance": row.runningBalance,
        })),
        {
          Section: header,
          Transaction: "Summary",
          Date: "",
          "Created At": "",
          Number: "",
          "Cheque Number": "",
          "Cheque Date": "",
          Party: "",
          Narration: "",
          Receipts: "",
          Payments: "",
          "Running Balance": "",
        },
        {
          Section: header,
          Transaction: "Opening balance",
          Date: "",
          "Created At": "",
          Number: "",
          "Cheque Number": "",
          "Cheque Date": "",
          Party: "",
          Narration: "",
          Receipts: "",
          Payments: "",
          "Running Balance": section.openingBalance,
        },
        {
          Section: header,
          Transaction: "Total receipts",
          Date: "",
          "Created At": "",
          Number: "",
          "Cheque Number": "",
          "Cheque Date": "",
          Party: "",
          Narration: "",
          Receipts: section.totalReceipts,
          Payments: "",
          "Running Balance": "",
        },
        {
          Section: header,
          Transaction: "Total payments",
          Date: "",
          "Created At": "",
          Number: "",
          "Cheque Number": "",
          "Cheque Date": "",
          Party: "",
          Narration: "",
          Receipts: "",
          Payments: section.totalPayments,
          "Running Balance": "",
        },
        {
          Section: header,
          Transaction: "Closing balance",
          Date: "",
          "Created At": "",
          Number: "",
          "Cheque Number": "",
          "Cheque Date": "",
          Party: "",
          Narration: "",
          Receipts: "",
          Payments: "",
          "Running Balance": section.closingBalance,
        },
      ];
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Bank Report");

    if (format === BankReportFormat.CSV) {
      return {
        buffer: Buffer.from(XLSX.utils.sheet_to_csv(worksheet), "utf8"),
        contentType: "text/csv; charset=utf-8",
        filename: "bank-report.csv",
      };
    }

    return {
      buffer: XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }),
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: "bank-report.xlsx",
    };
  }

  private async resolveBankAccounts(accountIds?: string[]) {
    const accounts = await this.accountRepository.find({
      where: { active: true },
      relations: ["accountType"],
    });
    const bankAccounts = accounts.filter(isBankLedgerAccount);
    if (!accountIds?.length) return bankAccounts;
    const selected = new Set(accountIds);
    return bankAccounts.filter((account) => selected.has(account.id));
  }

  private async resolveBranchLabels(branchIds: string[]) {
    const branches = await this.branchRepository.find({
      where: branchIds.length ? { id: In(branchIds) } : {},
    });
    return new Map(
      branches.map((branch) => [
        branch.id,
        toText(branch.name) || toText(branch.code) || branch.id,
      ]),
    );
  }

  private async collectMovements(input: {
    bankIds: string[];
    accountLabelById: Map<string, string>;
    branchIds: string[];
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
    bankIds: string[];
    accountLabelById: Map<string, string>;
    branchIds: string[];
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
    const bankIdSet = new Set(input.bankIds);
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
        if (!bankIdSet.has(voucher.headerAccountId ?? "")) continue;
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
          chequeNumber: toText(voucher.chequeNumber),
          chequeDate: toDateOnly(voucher.chequeDate),
          party: partyLabel || "-",
          narration: toText(voucher.narration),
          receiptsCents: isReceipt ? amountCents : 0,
          paymentsCents: isReceipt ? 0 : amountCents,
          isReceipt,
        });
        continue;
      }

      for (const item of voucher.items ?? []) {
        if (!bankIdSet.has(item.accountId)) continue;
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
          chequeNumber: toText(voucher.chequeNumber),
          chequeDate: toDateOnly(voucher.chequeDate),
          party: partyLabel || "-",
          narration: toText(voucher.narration),
          receiptsCents: isReceipt ? amountCents : 0,
          paymentsCents: isReceipt ? 0 : amountCents,
          isReceipt,
        });
      }
    }

    return movements;
  }

  private async collectPaymentMovements(input: {
    bankIds: string[];
    accountLabelById: Map<string, string>;
    branchIds: string[];
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
      .andWhere("payment.accountId IN (:...bankIds)", {
        bankIds: input.bankIds,
      });

    if (input.branchIds.length) {
      qb.andWhere("tx.branchId IN (:...branchIds)", {
        branchIds: input.branchIds,
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
        chequeNumber: toText(payment.referenceNumber),
        chequeDate: toDateOnly(payment.referenceDate),
        party: partyLabel,
        narration: toText(payment.remarks) || toText(tx.remarks) || "",
        receiptsCents: isReceipt ? amountCents : 0,
        paymentsCents: isReceipt ? 0 : amountCents,
        isReceipt,
      });
    }

    return movements;
  }

  private buildSections(
    layout: BankReportLayout,
    bankAccounts: AccountProfile[],
    openingMovements: Movement[],
    rangeMovements: Movement[],
    branchLabelById: Map<string, string>,
  ): ReportSection[] {
    const openingByKey = new Map<string, number>();
    for (const movement of openingMovements) {
      const key =
        layout === BankReportLayout.BRANCH_WISE
          ? `${movement.branchId}::${movement.accountId}`
          : movement.accountId;
      const current = openingByKey.get(key) ?? 0;
      openingByKey.set(
        key,
        current + movement.receiptsCents - movement.paymentsCents,
      );
    }

    const sectionMap = new Map<
      string,
      {
        branchId: string | null;
        branchLabel: string;
        accountId: string;
        accountLabel: string;
        openingCents: number;
        movements: Movement[];
      }
    >();

    const ensureSection = (
      branchId: string | null,
      branchLabel: string,
      accountId: string,
      accountLabel: string,
    ) => {
      const key =
        layout === BankReportLayout.BRANCH_WISE
          ? `${branchId}::${accountId}`
          : accountId;
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

    if (layout === BankReportLayout.CONSOLIDATED) {
      for (const account of bankAccounts) {
        ensureSection(
          null,
          "All Branches",
          account.id,
          `${account.accountCode} - ${account.accountName}`,
        );
      }
    }

    for (const movement of rangeMovements) {
      const section = ensureSection(
        layout === BankReportLayout.BRANCH_WISE ? movement.branchId : null,
        layout === BankReportLayout.BRANCH_WISE
          ? movement.branchLabel
          : "All Branches",
        movement.accountId,
        movement.accountLabel,
      );
      section.movements.push(movement);
    }

    // Include branch/account pairs that only have opening (no range activity)
    if (layout === BankReportLayout.BRANCH_WISE) {
      for (const [key, openingCents] of openingByKey.entries()) {
        if (sectionMap.has(key)) continue;
        const [branchId, accountId] = key.split("::");
        const account = bankAccounts.find((item) => item.id === accountId);
        if (!account) continue;
        ensureSection(
          branchId,
          branchLabelById.get(branchId) || branchId,
          accountId,
          `${account.accountCode} - ${account.accountName}`,
        ).openingCents = openingCents;
      }
    }

    const sections = Array.from(sectionMap.values())
      .map((section) => {
        let running = section.openingCents;
        let totalReceiptsCents = 0;
        let totalPaymentsCents = 0;
        const rows: ReportRow[] = [
          {
            transactionType: "Opening balance",
            date: "",
            createdAt: "",
            number: "",
            chequeNumber: "",
            chequeDate: "",
            party: "",
            narration: "",
            receipts: "",
            payments: "",
            runningBalance: money(running),
          },
        ];

        for (const movement of section.movements) {
          totalReceiptsCents += movement.receiptsCents;
          totalPaymentsCents += movement.paymentsCents;
          running += movement.receiptsCents - movement.paymentsCents;
          rows.push({
            transactionType: movement.isReceipt ? "Receipt" : "Payment",
            date: movement.transactionDate,
            createdAt: movement.createdAt,
            number: movement.number,
            chequeNumber: movement.chequeNumber,
            chequeDate: movement.chequeDate,
            party: movement.party,
            narration: movement.narration,
            receipts: movement.receiptsCents
              ? money(movement.receiptsCents)
              : "",
            payments: movement.paymentsCents
              ? money(movement.paymentsCents)
              : "",
            runningBalance: money(running),
          });
        }

        rows.push({
          transactionType: "Closing balance",
          date: "",
          createdAt: "",
          number: "",
          chequeNumber: "",
          chequeDate: "",
          party: "",
          narration: "",
          receipts: "",
          payments: "",
          runningBalance: money(running),
        });

        return {
          branchId: section.branchId,
          branchLabel: section.branchLabel,
          accountId: section.accountId,
          accountLabel: section.accountLabel,
          openingBalance: money(section.openingCents),
          totalReceipts: money(totalReceiptsCents),
          totalPayments: money(totalPaymentsCents),
          closingBalance: money(running),
          rows,
        };
      })
      .sort((left, right) => {
        const branchCompare = left.branchLabel.localeCompare(right.branchLabel);
        if (branchCompare !== 0) return branchCompare;
        return left.accountLabel.localeCompare(right.accountLabel);
      });

    return sections;
  }
}
