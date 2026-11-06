import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, ObjectLiteral, Repository, SelectQueryBuilder } from "typeorm";
import * as XLSX from "xlsx";
import PDFDocument from "pdfkit";
import { AccountProfile } from "../account-profiles/account-profile.entity";
import { Branch } from "../branches/branch.entity";
import { toBankReconDateOnly } from "../bank-reconciliation/bank-reconciliation-date.util";
import { toUtcNextDate } from "../common/date/date.util";
import {
  formatPaymentChequeReference,
  TransactionPaymentDirection,
  TransactionPaymentMethod,
  TransactionStatus,
} from "../transactions/transactions.enums";
import { TransactionPayment } from "../transactions/entities/transaction-payment.entity";
import { AccountingVoucher } from "../vouchers/entities";
import {
  VoucherAccountMode,
  VoucherEntryDirection,
  VoucherType,
} from "../vouchers/voucher.enums";
import { BankReportLayout } from "./dto/bank-report-query.dto";
import {
  BankReconciliationReportFormat,
  BankReconciliationReportQueryDto,
} from "./dto/bank-reconciliation-report-query.dto";

type ReportColumn = { key: string; label: string };

type ChequeLine = {
  branchId: string;
  branchLabel: string;
  accountId: string;
  accountLabel: string;
  isIssued: boolean;
  voucherNo: string;
  docDate: string;
  party: string;
  remarks: string;
  chequeNo: string;
  chequeDate: string;
  amountCents: number;
};

type DetailRow = {
  srNo: string;
  voucherNo: string;
  date: string;
  party: string;
  remarks: string;
  chequeNo: string;
  chequeDate: string;
  chequeAmount: string;
  amount: string;
};

type ReportSection = {
  branchId: string | null;
  branchLabel: string;
  accountId: string;
  accountLabel: string;
  bookBalance: string;
  issuedTotal: string;
  depositedTotal: string;
  bankBalance: string;
  issuedRows: DetailRow[];
  depositedRows: DetailRow[];
};

const COLUMNS: ReportColumn[] = [
  { key: "srNo", label: "Sr No" },
  { key: "voucherNo", label: "Voucher No." },
  { key: "date", label: "Date" },
  { key: "party", label: "Party" },
  { key: "remarks", label: "Remarks / Pax name" },
  { key: "chequeNo", label: "Chq. No." },
  { key: "chequeDate", label: "Chq. Date" },
  { key: "chequeAmount", label: "Chq. Amount" },
  { key: "amount", label: "Amount" },
];

const SECTION_LABELS = {
  book: "BALANCE AS PER THE BOOK",
  bank: "BALANCE AS PER THE BANK",
  issuedUncleared: "CHEQUES ISSUED BUT NOT PRESENTED - AMOUNT TO BE DEBIT",
  depositedUncleared:
    "CHEQUES DEPOSITED BUT NOT CLEARED - AMOUNT TO BE CREDIT",
  issuedCleared: "CHEQUES ISSUED AND PRESENTED",
  depositedCleared: "CHEQUES DEPOSITED AND CLEARED",
} as const;

const getChequeSectionLabels = (unclearedOnly: boolean) =>
  unclearedOnly
    ? {
        issued: SECTION_LABELS.issuedUncleared,
        deposited: SECTION_LABELS.depositedUncleared,
      }
    : {
        issued: SECTION_LABELS.issuedCleared,
        deposited: SECTION_LABELS.depositedCleared,
      };

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

const toDateOnly = (value: unknown) => toBankReconDateOnly(value);

const getSnapshotLabel = (
  snapshot: Record<string, unknown> | null | undefined,
) => {
  if (!snapshot) return "";
  const code = toText(snapshot.code) || toText(snapshot.accountCode);
  const name =
    toText(snapshot.name) ||
    toText(snapshot.label) ||
    toText(snapshot.accountName);
  if (code && name) return `${code} - ${name}`;
  return name || code;
};

const getPassengerName = (
  snapshot: Record<string, unknown> | null | undefined,
) => {
  if (!snapshot) return "";
  for (const key of [
    "panHolderName",
    "name",
    "fullName",
    "passengerName",
    "label",
  ]) {
    const value = toText(snapshot[key]);
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
export class BankReconciliationReportService {
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

  async buildReport(query: BankReconciliationReportQueryDto) {
    const startDate = toDateOnly(query.startDate);
    const endDate = toDateOnly(query.endDate);
    if (!startDate || !endDate) {
      throw new BadRequestException("Start date and end date are required");
    }
    if (startDate > endDate) {
      throw new BadRequestException("Start date cannot be after end date");
    }

    const layout = query.layout ?? BankReportLayout.BRANCH_WISE;
    const unclearedOnly = query.unclearedOnly !== false;
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

    const [bookByKey, chequeLines] = await Promise.all([
      this.collectBookBalances({
        bankIds,
        accountLabelById,
        branchIds,
        branchLabelById,
        asOfDate: endDate,
        layout,
      }),
      this.collectChequeLines({
        bankIds,
        accountLabelById,
        branchIds,
        branchLabelById,
        startDate,
        endDate,
        unclearedOnly,
      }),
    ]);

    const sections = this.buildSections(
      layout,
      bankAccounts,
      bookByKey,
      chequeLines,
      branchLabelById,
    );

    return { columns: COLUMNS, layout, sections };
  }

  async buildExport(
    query: BankReconciliationReportQueryDto,
    format: BankReconciliationReportFormat,
  ) {
    const report = await this.buildReport(query);
    const unclearedOnly = query.unclearedOnly !== false;
    const chequeLabels = getChequeSectionLabels(unclearedOnly);

    if (format === BankReconciliationReportFormat.PDF) {
      return this.buildPdf(report, chequeLabels);
    }

    const exportRows = report.sections.flatMap((section) => {
      const header =
        report.layout === BankReportLayout.BRANCH_WISE
          ? `${section.branchLabel} | ${section.accountLabel}`
          : section.accountLabel;

      const summaryRows = [
        {
          Section: header,
          "Sr No": "",
          "Voucher No.": SECTION_LABELS.book,
          Date: "",
          Party: "",
          "Remarks / Pax name": "",
          "Chq. No.": "",
          "Chq. Date": "",
          "Chq. Amount": "",
          Amount: section.bookBalance,
        },
        {
          Section: header,
          "Sr No": "",
          "Voucher No.": chequeLabels.issued,
          Date: "",
          Party: "",
          "Remarks / Pax name": "",
          "Chq. No.": "",
          "Chq. Date": "",
          "Chq. Amount": "",
          Amount: section.issuedTotal,
        },
        ...section.issuedRows.map((row) => ({
          Section: header,
          "Sr No": row.srNo,
          "Voucher No.": row.voucherNo,
          Date: row.date,
          Party: row.party,
          "Remarks / Pax name": row.remarks,
          "Chq. No.": row.chequeNo,
          "Chq. Date": row.chequeDate,
          "Chq. Amount": row.chequeAmount,
          Amount: row.amount,
        })),
        {
          Section: header,
          "Sr No": "",
          "Voucher No.": chequeLabels.deposited,
          Date: "",
          Party: "",
          "Remarks / Pax name": "",
          "Chq. No.": "",
          "Chq. Date": "",
          "Chq. Amount": "",
          Amount: section.depositedTotal,
        },
        ...section.depositedRows.map((row) => ({
          Section: header,
          "Sr No": row.srNo,
          "Voucher No.": row.voucherNo,
          Date: row.date,
          Party: row.party,
          "Remarks / Pax name": row.remarks,
          "Chq. No.": row.chequeNo,
          "Chq. Date": row.chequeDate,
          "Chq. Amount": row.chequeAmount,
          Amount: row.amount,
        })),
        {
          Section: header,
          "Sr No": "",
          "Voucher No.": SECTION_LABELS.bank,
          Date: "",
          Party: "",
          "Remarks / Pax name": "",
          "Chq. No.": "",
          "Chq. Date": "",
          "Chq. Amount": "",
          Amount: section.bankBalance,
        },
      ];
      return summaryRows;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Bank Recon");

    if (format === BankReconciliationReportFormat.CSV) {
      return {
        buffer: Buffer.from(XLSX.utils.sheet_to_csv(worksheet), "utf8"),
        contentType: "text/csv; charset=utf-8",
        filename: "bank-reconciliation-report.csv",
      };
    }

    return {
      buffer: XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }),
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: "bank-reconciliation-report.xlsx",
    };
  }

  private async buildPdf(
    report: {
      layout: BankReportLayout;
      sections: ReportSection[];
    },
    chequeLabels: { issued: string; deposited: string },
  ) {
    const lines: string[] = ["Bank Reconciliation Report", ""];
    for (const section of report.sections) {
      const header =
        report.layout === BankReportLayout.BRANCH_WISE
          ? `${section.branchLabel} | ${section.accountLabel}`
          : section.accountLabel;
      lines.push(header);
      lines.push(
        `${SECTION_LABELS.book}                    ${section.bookBalance}`,
      );
      lines.push(`${chequeLabels.issued}  ${section.issuedTotal}`);
      for (const row of section.issuedRows) {
        lines.push(
          `  ${row.srNo.padStart(3)} ${row.voucherNo} ${row.date} ${row.party} ${row.chequeNo} ${row.amount}`,
        );
      }
      lines.push(`${chequeLabels.deposited}  ${section.depositedTotal}`);
      for (const row of section.depositedRows) {
        lines.push(
          `  ${row.srNo.padStart(3)} ${row.voucherNo} ${row.date} ${row.party} ${row.chequeNo} ${row.amount}`,
        );
      }
      lines.push(
        `${SECTION_LABELS.bank}                    ${section.bankBalance}`,
      );
      lines.push("");
    }

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const document = new PDFDocument({
        size: "A4",
        layout: "landscape",
        margin: 24,
        compress: false,
      });
      const chunks: Buffer[] = [];
      document.on("data", (chunk: Buffer) => chunks.push(chunk));
      document.on("end", () => resolve(Buffer.concat(chunks)));
      document.on("error", reject);
      document.font("Courier").fontSize(8);
      for (const line of lines) {
        document.text(line.replace(/[^\x20-\x7E]/g, " "), { lineGap: 1 });
      }
      document.end();
    });

    return {
      buffer,
      contentType: "application/pdf",
      filename: "bank-reconciliation-report.pdf",
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

  private sectionKey(
    layout: BankReportLayout,
    branchId: string,
    accountId: string,
  ) {
    return layout === BankReportLayout.BRANCH_WISE
      ? `${branchId}::${accountId}`
      : accountId;
  }

  private async collectBookBalances(input: {
    bankIds: string[];
    accountLabelById: Map<string, string>;
    branchIds: string[];
    branchLabelById: Map<string, string>;
    asOfDate: string;
    layout: BankReportLayout;
  }) {
    const [voucherMovements, paymentMovements] = await Promise.all([
      this.collectVoucherBookMovements(input),
      this.collectPaymentBookMovements(input),
    ]);

    const bookByKey = new Map<string, number>();
    for (const movement of [...voucherMovements, ...paymentMovements]) {
      const key = this.sectionKey(
        input.layout,
        movement.branchId,
        movement.accountId,
      );
      bookByKey.set(
        key,
        (bookByKey.get(key) ?? 0) +
          movement.receiptsCents -
          movement.paymentsCents,
      );
    }
    return bookByKey;
  }

  private async collectVoucherBookMovements(input: {
    bankIds: string[];
    accountLabelById: Map<string, string>;
    branchIds: string[];
    branchLabelById: Map<string, string>;
    asOfDate: string;
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
      })
      .andWhere("voucher.transactionDate <= :asOfDate", {
        asOfDate: input.asOfDate,
      });

    if (input.branchIds.length) {
      qb.andWhere("voucher.branchId IN (:...branchIds)", {
        branchIds: input.branchIds,
      });
    }

    const vouchers = await qb.getMany();
    const bankIdSet = new Set(input.bankIds);
    const movements: Array<{
      branchId: string;
      accountId: string;
      receiptsCents: number;
      paymentsCents: number;
    }> = [];

    for (const voucher of vouchers) {
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
          accountId: voucher.headerAccountId!,
          receiptsCents: isReceipt ? amountCents : 0,
          paymentsCents: isReceipt ? 0 : amountCents,
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
          accountId: item.accountId,
          receiptsCents: isReceipt ? amountCents : 0,
          paymentsCents: isReceipt ? 0 : amountCents,
        });
      }
    }

    return movements;
  }

  private async collectPaymentBookMovements(input: {
    bankIds: string[];
    branchIds: string[];
    asOfDate: string;
  }) {
    const qb = this.paymentRepository
      .createQueryBuilder("payment")
      .innerJoinAndSelect("payment.transaction", "tx")
      .where("tx.status = :status", { status: TransactionStatus.APPROVED })
      .andWhere("tx.isLatest = true")
      .andWhere("payment.accountId IN (:...bankIds)", {
        bankIds: input.bankIds,
      });
    this.applyTimestamptzAsOfFilter(qb, "tx.transactionDate", input.asOfDate);

    if (input.branchIds.length) {
      qb.andWhere("tx.branchId IN (:...branchIds)", {
        branchIds: input.branchIds,
      });
    }

    const payments = await qb.getMany();
    return payments
      .filter((payment) => payment.transaction && cents(payment.amount) > 0)
      .map((payment) => {
        const isReceipt =
          normalizeUpper(payment.paymentDirection) ===
          TransactionPaymentDirection.RECEIPT;
        const amountCents = cents(payment.amount);
        return {
          branchId: payment.transaction.branchId,
          accountId: payment.accountId,
          receiptsCents: isReceipt ? amountCents : 0,
          paymentsCents: isReceipt ? 0 : amountCents,
        };
      });
  }

  private async collectChequeLines(input: {
    bankIds: string[];
    accountLabelById: Map<string, string>;
    branchIds: string[];
    branchLabelById: Map<string, string>;
    startDate: string;
    endDate: string;
    unclearedOnly: boolean;
  }): Promise<ChequeLine[]> {
    const [paymentLines, voucherLines] = await Promise.all([
      this.collectPaymentChequeLines(input),
      this.collectVoucherChequeLines(input),
    ]);
    return [...paymentLines, ...voucherLines].sort((left, right) => {
      const chequeCompare = left.chequeDate.localeCompare(right.chequeDate);
      if (chequeCompare !== 0) return chequeCompare;
      const dateCompare = left.docDate.localeCompare(right.docDate);
      if (dateCompare !== 0) return dateCompare;
      return left.voucherNo.localeCompare(right.voucherNo);
    });
  }

  /**
   * Detail rows always filter by cheque date (From–To).
   * Unreconciled Yes: still open (no bank date, not dishonored).
   * Unreconciled No: cleared or dishonored.
   */
  private applyPaymentChequeFilters<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    input: { startDate: string; endDate: string; unclearedOnly: boolean },
  ) {
    this.applyDateColumnRange(qb, "payment.referenceDate", input);
    this.applyChequeClearanceFilter(qb, "payment", input.unclearedOnly);
  }

  private applyVoucherChequeFilters<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    input: { startDate: string; endDate: string; unclearedOnly: boolean },
  ) {
    this.applyDateColumnRange(qb, "voucher.chequeDate", input);
    this.applyChequeClearanceFilter(qb, "voucher", input.unclearedOnly);
  }

  private applyDateColumnRange<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    dateColumn: string,
    input: { startDate: string; endDate: string },
  ) {
    qb.andWhere(`${dateColumn} IS NOT NULL`)
      .andWhere(`${dateColumn} >= :chequeStartDate`, {
        chequeStartDate: input.startDate,
      })
      .andWhere(`${dateColumn} <= :chequeEndDate`, {
        chequeEndDate: input.endDate,
      });
  }

  private applyChequeClearanceFilter(
    qb: { andWhere: (sql: string, params?: object) => unknown },
    alias: string,
    unclearedOnly: boolean,
  ) {
    if (unclearedOnly) {
      qb.andWhere(
        `${alias}.bankDate IS NULL AND ${alias}.isDishonored = false`,
      );
      return;
    }
    qb.andWhere(
      `(${alias}.bankDate IS NOT NULL OR ${alias}.isDishonored = true)`,
    );
  }

  /**
   * Transaction.transactionDate is timestamptz stored as UTC midnight of the
   * calendar business date. Compare on the UTC calendar date, not session TZ.
   */
  private applyTimestamptzAsOfFilter<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    dateColumn: string,
    asOfDate: string,
  ) {
    const asOfExclusive = toUtcNextDate(asOfDate);
    if (!asOfExclusive) {
      throw new BadRequestException("As-of date is required");
    }
    qb.andWhere(`${dateColumn} < :asOfExclusive`, { asOfExclusive });
  }

  private async collectPaymentChequeLines(input: {
    bankIds: string[];
    accountLabelById: Map<string, string>;
    branchIds: string[];
    branchLabelById: Map<string, string>;
    startDate: string;
    endDate: string;
    unclearedOnly: boolean;
  }): Promise<ChequeLine[]> {
    const qb = this.paymentRepository
      .createQueryBuilder("payment")
      .innerJoinAndSelect("payment.transaction", "tx")
      .where("tx.status = :status", { status: TransactionStatus.APPROVED })
      .andWhere("tx.isLatest = true")
      .andWhere("payment.accountId IN (:...bankIds)", {
        bankIds: input.bankIds,
      })
      .andWhere("payment.paymentMethod = :chequeMethod", {
        chequeMethod: TransactionPaymentMethod.CHEQUE,
      });

    this.applyPaymentChequeFilters(qb, input);

    if (input.branchIds.length) {
      qb.andWhere("tx.branchId IN (:...branchIds)", {
        branchIds: input.branchIds,
      });
    }

    const payments = await qb.getMany();
    const lines: ChequeLine[] = [];

    for (const payment of payments) {
      const tx = payment.transaction;
      if (!tx) continue;
      const amountCents = cents(payment.amount);
      if (amountCents <= 0) continue;

      const branchLabel =
        input.branchLabelById.get(tx.branchId) ||
        getSnapshotLabel(tx.branchSnapshot as Record<string, unknown>) ||
        tx.branchId;
      const partySnapshot = tx.partyProfileSnapshot as Record<
        string,
        unknown
      > | null;
      const passengerSnapshot = tx.passengerSnapshot as Record<
        string,
        unknown
      > | null;
      const party = isIndividualParty(partySnapshot)
        ? getPassengerName(passengerSnapshot) ||
          getSnapshotLabel(partySnapshot) ||
          "-"
        : getSnapshotLabel(partySnapshot) || "-";
      const isReceipt =
        normalizeUpper(payment.paymentDirection) ===
        TransactionPaymentDirection.RECEIPT;

      lines.push({
        branchId: tx.branchId,
        branchLabel,
        accountId: payment.accountId,
        accountLabel:
          input.accountLabelById.get(payment.accountId) ||
          getSnapshotLabel(
            payment.accountSnapshot as Record<string, unknown>,
          ),
        isIssued: !isReceipt,
        voucherNo: toText(tx.number),
        docDate: toDateOnly(tx.transactionDate),
        party,
        remarks: toText(payment.remarks) || toText(tx.remarks) || "",
        chequeNo: formatPaymentChequeReference(
          payment.paymentMethod,
          payment.referenceNumber,
        ),
        chequeDate: toDateOnly(payment.referenceDate),
        amountCents,
      });
    }

    return lines;
  }

  private async collectVoucherChequeLines(input: {
    bankIds: string[];
    accountLabelById: Map<string, string>;
    branchIds: string[];
    branchLabelById: Map<string, string>;
    startDate: string;
    endDate: string;
    unclearedOnly: boolean;
  }): Promise<ChequeLine[]> {
    const qb = this.voucherRepository
      .createQueryBuilder("voucher")
      .leftJoinAndSelect("voucher.items", "items")
      .where("voucher.voucherType IN (:...types)", {
        types: [
          VoucherType.RECEIPT,
          VoucherType.PAYMENT,
          VoucherType.DEPOSIT_WITHDRAWAL,
        ],
      })
      .andWhere(
        `(
          voucher.chequeNumber IS NOT NULL
          OR voucher.accountMode = :bankChequeMode
          OR voucher.paymentMethod = :chequeMethod
        )`,
        {
          bankChequeMode: VoucherAccountMode.BANK_CHEQUE,
          chequeMethod: TransactionPaymentMethod.CHEQUE,
        },
      );

    this.applyVoucherChequeFilters(qb, input);

    if (input.branchIds.length) {
      qb.andWhere("voucher.branchId IN (:...branchIds)", {
        branchIds: input.branchIds,
      });
    }

    const vouchers = await qb.getMany();
    const bankIdSet = new Set(input.bankIds);
    const lines: ChequeLine[] = [];

    for (const voucher of vouchers) {
      const branchLabel =
        input.branchLabelById.get(voucher.branchId) ||
        getSnapshotLabel(voucher.branchSnapshot as Record<string, unknown>) ||
        voucher.branchId;
      const party =
        getSnapshotLabel(
          voucher.partyProfileSnapshot as Record<string, unknown>,
        ) ||
        toText(voucher.panName) ||
        "-";
      const remarks = toText(voucher.narration);

      if (
        voucher.voucherType === VoucherType.RECEIPT ||
        voucher.voucherType === VoucherType.PAYMENT
      ) {
        if (!bankIdSet.has(voucher.headerAccountId ?? "")) continue;
        const amountCents = cents(voucher.finalAmount);
        if (amountCents <= 0) continue;
        const isReceipt = voucher.voucherType === VoucherType.RECEIPT;
        lines.push({
          branchId: voucher.branchId,
          branchLabel,
          accountId: voucher.headerAccountId!,
          accountLabel:
            input.accountLabelById.get(voucher.headerAccountId!) ||
            getSnapshotLabel(
              voucher.headerAccountSnapshot as Record<string, unknown>,
            ),
          isIssued: !isReceipt,
          voucherNo: toText(voucher.number),
          docDate: toDateOnly(voucher.transactionDate),
          party,
          remarks,
          chequeNo: toText(voucher.chequeNumber),
          chequeDate: toDateOnly(voucher.chequeDate),
          amountCents,
        });
        continue;
      }

      for (const item of voucher.items ?? []) {
        if (!bankIdSet.has(item.accountId)) continue;
        const amountCents = cents(item.amount);
        if (amountCents <= 0) continue;
        const isReceipt = item.direction === VoucherEntryDirection.DEBIT;
        lines.push({
          branchId: voucher.branchId,
          branchLabel,
          accountId: item.accountId,
          accountLabel:
            input.accountLabelById.get(item.accountId) ||
            getSnapshotLabel(
              item.accountSnapshot as Record<string, unknown>,
            ),
          isIssued: !isReceipt,
          voucherNo: toText(voucher.number),
          docDate: toDateOnly(voucher.transactionDate),
          party,
          remarks,
          chequeNo: toText(voucher.chequeNumber),
          chequeDate: toDateOnly(voucher.chequeDate),
          amountCents,
        });
      }
    }

    return lines;
  }

  private toDetailRows(lines: ChequeLine[]): DetailRow[] {
    return lines.map((line, index) => ({
      srNo: String(index + 1),
      voucherNo: line.voucherNo,
      date: line.docDate,
      party: line.party,
      remarks: line.remarks,
      chequeNo: line.chequeNo,
      chequeDate: line.chequeDate,
      chequeAmount: money(line.amountCents),
      amount: money(line.amountCents),
    }));
  }

  private buildSections(
    layout: BankReportLayout,
    bankAccounts: AccountProfile[],
    bookByKey: Map<string, number>,
    chequeLines: ChequeLine[],
    branchLabelById: Map<string, string>,
  ): ReportSection[] {
    const sectionMap = new Map<
      string,
      {
        branchId: string | null;
        branchLabel: string;
        accountId: string;
        accountLabel: string;
        issued: ChequeLine[];
        deposited: ChequeLine[];
      }
    >();

    const ensure = (
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
          branchLabel:
            layout === BankReportLayout.CONSOLIDATED
              ? "Consolidated"
              : branchLabel,
          accountId,
          accountLabel,
          issued: [],
          deposited: [],
        };
        sectionMap.set(key, section);
      }
      return { key, section };
    };

    for (const account of bankAccounts) {
      const accountLabel = `${account.accountCode} - ${account.accountName}`;
      if (layout === BankReportLayout.CONSOLIDATED) {
        ensure(null, "Consolidated", account.id, accountLabel);
      } else {
        for (const [branchId, branchLabel] of branchLabelById.entries()) {
          ensure(branchId, branchLabel, account.id, accountLabel);
        }
        for (const line of chequeLines) {
          if (line.accountId !== account.id) continue;
          ensure(
            line.branchId,
            line.branchLabel,
            account.id,
            accountLabel,
          );
        }
      }
    }

    for (const line of chequeLines) {
      const { section } = ensure(
        layout === BankReportLayout.BRANCH_WISE ? line.branchId : null,
        line.branchLabel,
        line.accountId,
        line.accountLabel,
      );
      if (line.isIssued) section.issued.push(line);
      else section.deposited.push(line);
    }

    const sections: ReportSection[] = [];
    for (const [key, section] of sectionMap.entries()) {
      const bookCents = bookByKey.get(key) ?? 0;
      const issuedCents = section.issued.reduce(
        (sum, row) => sum + row.amountCents,
        0,
      );
      const depositedCents = section.deposited.reduce(
        (sum, row) => sum + row.amountCents,
        0,
      );
      const bankCents = bookCents - issuedCents + depositedCents;

      const hasChequeEntries =
        section.issued.length > 0 || section.deposited.length > 0;

      // Always keep sections that have Issued / Deposited cheque entries.
      // Otherwise skip empty pre-seeded branch/account combos with no book activity.
      if (!hasChequeEntries) {
        if (
          bookCents === 0 &&
          layout === BankReportLayout.BRANCH_WISE &&
          !bookByKey.has(key)
        ) {
          continue;
        }
        if (bookCents === 0 && !bookByKey.has(key)) {
          continue;
        }
      }

      sections.push({
        branchId: section.branchId,
        branchLabel: section.branchLabel,
        accountId: section.accountId,
        accountLabel: section.accountLabel,
        bookBalance: money(bookCents),
        issuedTotal: money(issuedCents),
        depositedTotal: money(depositedCents),
        bankBalance: money(bankCents),
        issuedRows: this.toDetailRows(section.issued),
        depositedRows: this.toDetailRows(section.deposited),
      });
    }

    return sections.sort((left, right) => {
      const branchCompare = left.branchLabel.localeCompare(right.branchLabel);
      if (branchCompare !== 0) return branchCompare;
      return left.accountLabel.localeCompare(right.accountLabel);
    });
  }
}
