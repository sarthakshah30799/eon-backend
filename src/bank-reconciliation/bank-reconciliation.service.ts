import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, ObjectLiteral, Repository, SelectQueryBuilder } from "typeorm";
import { AccountProfile } from "../account-profiles/account-profile.entity";
import { Branch } from "../branches/branch.entity";
import { toUtcDateOnly, toUtcNextDate } from "../common/date/date.util";
import {
  formatPaymentChequeReference,
  TransactionPaymentDirection,
  TransactionPaymentMethod,
  TransactionStatus,
} from "../transactions/transactions.enums";
import { toBankReconDateOnly } from "./bank-reconciliation-date.util";
import { TransactionPayment } from "../transactions/entities/transaction-payment.entity";
import { AccountingVoucher } from "../vouchers/entities";
import {
  VoucherAccountMode,
  VoucherEntryDirection,
  VoucherType,
} from "../vouchers/voucher.enums";
import {
  BankReconciliationClearDto,
  BankReconciliationSourceType,
} from "./dto/bank-reconciliation-clear.dto";
import {
  BankReconciliationQueryDto,
  BankReconciliationTransactionType,
} from "./dto/bank-reconciliation-query.dto";
import {
  BankReconciliationClearResultDto,
  BankReconciliationResponseDto,
  BankReconciliationRowDto,
  BankReconciliationSection,
} from "./dto/bank-reconciliation-response.dto";

const toText = (value: unknown) => String(value ?? "").trim();

const normalizeUpper = (value: unknown) =>
  toText(value)
    .replace(/[\s-]+/g, "_")
    .toUpperCase();

const toDateOnly = (value: unknown) => toBankReconDateOnly(value);

const getSnapshotCode = (
  snapshot: Record<string, unknown> | null | undefined,
) => {
  if (!snapshot) return "";
  return toText(snapshot.code) || toText(snapshot.accountCode);
};

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

const isBankLedgerAccount = (account: AccountProfile) => {
  const tokens = [
    account.accountType?.value,
    account.accountType?.label,
  ].map(normalizeUpper);
  return tokens.includes("BANK_LEDGER");
};

const amountString = (value: unknown) => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "0.00";
  return numeric.toFixed(2);
};

@Injectable()
export class BankReconciliationService {
  constructor(
    @InjectRepository(AccountProfile)
    private readonly accountRepository: Repository<AccountProfile>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(AccountingVoucher, "database2")
    private readonly voucherRepository: Repository<AccountingVoucher>,
    @InjectRepository(TransactionPayment, "database2")
    private readonly paymentRepository: Repository<TransactionPayment>,
    @InjectDataSource("database2")
    private readonly database2: DataSource,
  ) {}

  async query(
    query: BankReconciliationQueryDto,
    session: any,
  ): Promise<BankReconciliationResponseDto> {
    const startDate = toDateOnly(query.startDate);
    const endDate = toDateOnly(query.endDate);
    if (!startDate || !endDate) {
      throw new BadRequestException("Start date and end date are required");
    }
    if (startDate > endDate) {
      throw new BadRequestException("Start date cannot be after end date");
    }

    const bankAccounts = await this.resolveBankAccounts(query.bankAccountId);
    if (!bankAccounts.length) {
      return { receivedNotDeposited: [], issuedNotPresented: [] };
    }
    const bankAccountIds = bankAccounts.map((account) => account.id);
    const bankCodeById = new Map(
      bankAccounts.map((account) => [account.id, account.accountCode]),
    );
    const branchId = await this.resolveBranchId(query.branchId, session);
    const unclearedOnly = query.unclearedOnly !== false;
    const transactionType =
      query.transactionType ?? BankReconciliationTransactionType.ALL;
    const passengerName = toText(query.passengerName);

    const includePayments =
      transactionType === BankReconciliationTransactionType.ALL ||
      transactionType === BankReconciliationTransactionType.BUYING_SELLING;
    const includeReceiptPayment =
      transactionType === BankReconciliationTransactionType.ALL ||
      transactionType === BankReconciliationTransactionType.RECEIPT_PAYMENT;
    const includeDepositWithdrawal =
      transactionType === BankReconciliationTransactionType.ALL ||
      transactionType ===
        BankReconciliationTransactionType.DEPOSIT_WITHDRAWAL;

    const [paymentRows, voucherRows] = await Promise.all([
      includePayments
        ? this.collectPaymentRows({
            bankAccountIds,
            bankCodeById,
            branchId,
            startDate,
            endDate,
            unclearedOnly,
            passengerName,
          })
        : Promise.resolve([] as BankReconciliationRowDto[]),
      includeReceiptPayment || includeDepositWithdrawal
        ? this.collectVoucherRows({
            bankAccountIds,
            bankCodeById,
            branchId,
            startDate,
            endDate,
            unclearedOnly,
            passengerName,
            includeReceiptPayment,
            includeDepositWithdrawal,
          })
        : Promise.resolve([] as BankReconciliationRowDto[]),
    ]);

    const rows = [...paymentRows, ...voucherRows].sort((left, right) => {
      const dateCompare = left.docDate.localeCompare(right.docDate);
      if (dateCompare !== 0) return dateCompare;
      return left.docNumber.localeCompare(right.docNumber);
    });

    return {
      receivedNotDeposited: rows.filter(
        (row) =>
          row.section === BankReconciliationSection.RECEIVED_NOT_DEPOSITED,
      ),
      issuedNotPresented: rows.filter(
        (row) =>
          row.section === BankReconciliationSection.ISSUED_NOT_PRESENTED,
      ),
    };
  }

  async clear(
    dto: BankReconciliationClearDto,
    session: any,
  ): Promise<BankReconciliationClearResultDto> {
    const actorId = toText(session?.userId);
    if (!actorId) {
      throw new BadRequestException("Authenticated user is required");
    }
    if (!dto.items?.length) {
      throw new BadRequestException("At least one item is required");
    }

    for (const item of dto.items) {
      const bankDate = toDateOnly(item.bankDate);
      if (!bankDate) {
        throw new BadRequestException("Bank date is required for each item");
      }
      if (item.isDishonored && !toText(item.reversalNumber)) {
        throw new BadRequestException(
          "Reversal number is required when dishonor is selected",
        );
      }
    }

    const paymentItems = dto.items.filter(
      (item) =>
        item.sourceType === BankReconciliationSourceType.TRANSACTION_PAYMENT,
    );
    const voucherItems = dto.items.filter(
      (item) =>
        item.sourceType === BankReconciliationSourceType.ACCOUNTING_VOUCHER,
    );
    const paymentIds = [...new Set(paymentItems.map((item) => item.sourceId))];
    const voucherIds = [...new Set(voucherItems.map((item) => item.sourceId))];

    return this.database2.transaction(async (em) => {
      let updated = 0;

      if (paymentIds.length) {
        const payments = await em.find(TransactionPayment, {
          where: { id: In(paymentIds) },
        });
        const byId = new Map(payments.map((row) => [row.id, row]));
        for (const item of paymentItems) {
          const payment = byId.get(item.sourceId);
          if (!payment) {
            throw new NotFoundException(
              `Transaction payment ${item.sourceId} not found`,
            );
          }
          this.applyClearance(payment, item, actorId);
          await em.save(TransactionPayment, payment);
          updated += 1;
        }
      }

      if (voucherIds.length) {
        const vouchers = await em.find(AccountingVoucher, {
          where: { id: In(voucherIds) },
        });
        const byId = new Map(vouchers.map((row) => [row.id, row]));
        const seen = new Set<string>();
        for (const item of voucherItems) {
          if (seen.has(item.sourceId)) continue;
          seen.add(item.sourceId);
          const voucher = byId.get(item.sourceId);
          if (!voucher) {
            throw new NotFoundException(
              `Accounting voucher ${item.sourceId} not found`,
            );
          }
          this.applyClearance(voucher, item, actorId);
          await em.save(AccountingVoucher, voucher);
          updated += 1;
        }
      }

      return { updated };
    });
  }

  private applyClearance(
    target: {
      bankDate: string | null;
      reconciliationRemarks: string | null;
      isDishonored: boolean;
      reversalNumber: string | null;
      updatedBy?: string;
    },
    item: BankReconciliationClearDto["items"][number],
    actorId: string,
  ) {
    const bankDate = toDateOnly(item.bankDate);
    const isDishonored = Boolean(item.isDishonored);
    target.bankDate = bankDate;
    target.reconciliationRemarks =
      toText(item.reconciliationRemarks) || null;
    if (isDishonored) {
      target.isDishonored = true;
      target.reversalNumber = toText(item.reversalNumber);
    } else {
      target.isDishonored = false;
      target.reversalNumber = null;
    }
    if ("updatedBy" in target) {
      target.updatedBy = actorId;
    }
  }

  private async resolveBankAccounts(bankAccountId?: string) {
    const accounts = await this.accountRepository.find({
      where: { active: true },
      relations: ["accountType"],
    });
    const bankAccounts = accounts.filter(isBankLedgerAccount);
    const selectedId = toText(bankAccountId);
    if (!selectedId) {
      return bankAccounts;
    }
    const selected = bankAccounts.find((account) => account.id === selectedId);
    if (!selected) {
      throw new BadRequestException(
        "A valid BANK LEDGER account is required",
      );
    }
    return [selected];
  }

  private async resolveBranchId(
    branchId: string | undefined,
    session: any,
  ): Promise<string | null> {
    const requested = toText(branchId);
    const active = toText(session?.activeBranchId);
    const isHo = Boolean(session?.isHo || session?.user?.isHo);
    const effective = isHo ? requested || active : active || requested;
    if (!effective) return null;
    const branch = await this.branchRepository.findOne({
      where: { id: effective, isActive: true },
    });
    if (!branch) {
      throw new BadRequestException("Branch not found or inactive");
    }
    return branch.id;
  }

  private applyUnclearedFilter(
    qb: { andWhere: (sql: string, params?: object) => unknown },
    alias: string,
    unclearedOnly: boolean,
  ) {
    if (unclearedOnly) {
      // Cleared = bank date present; uncleared = no bank date and not dishonored
      qb.andWhere(
        `${alias}.bankDate IS NULL AND ${alias}.isDishonored = false`,
      );
    } else {
      qb.andWhere(
        `(${alias}.bankDate IS NOT NULL OR ${alias}.isDishonored = true)`,
      );
    }
  }

  private applyTimestamptzDateRange<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    dateColumn: string,
    input: { startDate: string; endDate: string },
  ) {
    const rangeStart = toUtcDateOnly(input.startDate);
    const rangeEndExclusive = toUtcNextDate(input.endDate);
    if (!rangeEndExclusive) {
      throw new BadRequestException("End date is required");
    }
    qb.andWhere(`${dateColumn} >= :rangeStart`, { rangeStart }).andWhere(
      `${dateColumn} < :rangeEndExclusive`,
      { rangeEndExclusive },
    );
  }

  private async collectPaymentRows(input: {
    bankAccountIds: string[];
    bankCodeById: Map<string, string>;
    branchId: string | null;
    startDate: string;
    endDate: string;
    unclearedOnly: boolean;
    passengerName: string;
  }): Promise<BankReconciliationRowDto[]> {
    if (!input.bankAccountIds.length) return [];

    const qb = this.paymentRepository
      .createQueryBuilder("payment")
      .innerJoinAndSelect("payment.transaction", "tx")
      .where("tx.status = :status", { status: TransactionStatus.APPROVED })
      .andWhere("tx.isLatest = true")
      .andWhere("payment.accountId IN (:...bankAccountIds)", {
        bankAccountIds: input.bankAccountIds,
      })
      .andWhere("payment.paymentMethod = :chequeMethod", {
        chequeMethod: TransactionPaymentMethod.CHEQUE,
      });
    this.applyTimestamptzDateRange(qb, "tx.transactionDate", input);

    if (input.branchId) {
      qb.andWhere("tx.branchId = :branchId", { branchId: input.branchId });
    }
    this.applyUnclearedFilter(qb, "payment", input.unclearedOnly);

    if (input.passengerName) {
      qb.andWhere(
        `(
          COALESCE(tx.passengerSnapshot->>'panHolderName','') ILIKE :passengerName
          OR COALESCE(tx.passengerSnapshot->>'name','') ILIKE :passengerName
          OR COALESCE(tx.passengerSnapshot->>'fullName','') ILIKE :passengerName
          OR COALESCE(tx.passengerSnapshot->>'passengerName','') ILIKE :passengerName
          OR COALESCE(tx.partyProfileSnapshot->>'name','') ILIKE :passengerName
        )`,
        { passengerName: `%${input.passengerName}%` },
      );
    }

    const payments = await qb.getMany();
    const rows: BankReconciliationRowDto[] = [];

    for (const payment of payments) {
      const tx = payment.transaction;
      if (!tx) continue;
      const amount = Number(payment.amount ?? 0);
      if (!Number.isFinite(amount) || amount <= 0) continue;

      const isReceipt =
        normalizeUpper(payment.paymentDirection) ===
        TransactionPaymentDirection.RECEIPT;
      const branchSnapshot = tx.branchSnapshot as Record<string, unknown>;
      const passengerSnapshot = tx.passengerSnapshot as Record<
        string,
        unknown
      > | null;
      const partySnapshot = tx.partyProfileSnapshot as Record<
        string,
        unknown
      > | null;
      const accountSnapshot = payment.accountSnapshot as Record<
        string,
        unknown
      > | null;

      rows.push({
        sourceType: BankReconciliationSourceType.TRANSACTION_PAYMENT,
        sourceId: payment.id,
        section: isReceipt
          ? BankReconciliationSection.RECEIVED_NOT_DEPOSITED
          : BankReconciliationSection.ISSUED_NOT_PRESENTED,
        branchCode:
          getSnapshotCode(branchSnapshot) || toText(tx.branchId).slice(0, 8),
        docType: toText(tx.transactionType) || "TXN",
        docNumber: toText(tx.number),
        docDate: toDateOnly(tx.transactionDate),
        passengerName:
          getPassengerName(passengerSnapshot) ||
          getSnapshotLabel(partySnapshot) ||
          "",
        amount: amountString(payment.amount),
        chequeNo: formatPaymentChequeReference(
          payment.paymentMethod,
          payment.referenceNumber,
        ),
        chequeDate: toDateOnly(payment.referenceDate),
        bankCode:
          getSnapshotCode(accountSnapshot) ||
          toText(input.bankCodeById.get(payment.accountId)),
        bankDate: payment.bankDate ? toDateOnly(payment.bankDate) : null,
        reconciliationRemarks: payment.reconciliationRemarks,
        isDishonored: Boolean(payment.isDishonored),
        reversalNumber: payment.reversalNumber,
      });
    }

    return rows;
  }

  private async collectVoucherRows(input: {
    bankAccountIds: string[];
    bankCodeById: Map<string, string>;
    branchId: string | null;
    startDate: string;
    endDate: string;
    unclearedOnly: boolean;
    passengerName: string;
    includeReceiptPayment: boolean;
    includeDepositWithdrawal: boolean;
  }): Promise<BankReconciliationRowDto[]> {
    if (!input.bankAccountIds.length) return [];

    const bankIdSet = new Set(input.bankAccountIds);
    const types: string[] = [];
    if (input.includeReceiptPayment) {
      types.push(VoucherType.RECEIPT, VoucherType.PAYMENT);
    }
    if (input.includeDepositWithdrawal) {
      types.push(VoucherType.DEPOSIT_WITHDRAWAL);
    }
    if (!types.length) return [];

    const qb = this.voucherRepository
      .createQueryBuilder("voucher")
      .leftJoinAndSelect("voucher.items", "items")
      .where("voucher.voucherType IN (:...types)", { types })
      .andWhere("voucher.transactionDate >= :startDate", {
        startDate: input.startDate,
      })
      .andWhere("voucher.transactionDate <= :endDate", {
        endDate: input.endDate,
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

    if (input.branchId) {
      qb.andWhere("voucher.branchId = :branchId", {
        branchId: input.branchId,
      });
    }
    this.applyUnclearedFilter(qb, "voucher", input.unclearedOnly);

    if (input.passengerName) {
      qb.andWhere(
        `(
          COALESCE(voucher.partyProfileSnapshot->>'name','') ILIKE :passengerName
          OR COALESCE(voucher.partyProfileSnapshot->>'label','') ILIKE :passengerName
          OR COALESCE(voucher.panName,'') ILIKE :passengerName
          OR COALESCE(voucher.narration,'') ILIKE :passengerName
        )`,
        { passengerName: `%${input.passengerName}%` },
      );
    }

    const vouchers = await qb.getMany();
    const rows: BankReconciliationRowDto[] = [];

    for (const voucher of vouchers) {
      const branchSnapshot = voucher.branchSnapshot as Record<
        string,
        unknown
      >;
      const partySnapshot = voucher.partyProfileSnapshot as Record<
        string,
        unknown
      > | null;
      const headerSnapshot = voucher.headerAccountSnapshot as Record<
        string,
        unknown
      > | null;
      const passengerName =
        toText(voucher.panName) ||
        getSnapshotLabel(partySnapshot) ||
        "";

      if (
        voucher.voucherType === VoucherType.RECEIPT ||
        voucher.voucherType === VoucherType.PAYMENT
      ) {
        if (!bankIdSet.has(voucher.headerAccountId ?? "")) continue;
        const amount = Number(voucher.finalAmount ?? 0);
        if (!Number.isFinite(amount) || amount <= 0) continue;
        const isReceipt = voucher.voucherType === VoucherType.RECEIPT;
        rows.push({
          sourceType: BankReconciliationSourceType.ACCOUNTING_VOUCHER,
          sourceId: voucher.id,
          section: isReceipt
            ? BankReconciliationSection.RECEIVED_NOT_DEPOSITED
            : BankReconciliationSection.ISSUED_NOT_PRESENTED,
          branchCode:
            getSnapshotCode(branchSnapshot) ||
            toText(voucher.branchId).slice(0, 8),
          docType: voucher.voucherType,
          docNumber: toText(voucher.number),
          docDate: toDateOnly(voucher.transactionDate),
          passengerName,
          amount: amountString(voucher.finalAmount),
          chequeNo: toText(voucher.chequeNumber),
          chequeDate: toDateOnly(voucher.chequeDate),
          bankCode:
            getSnapshotCode(headerSnapshot) ||
            toText(input.bankCodeById.get(voucher.headerAccountId ?? "")),
          bankDate: voucher.bankDate ? toDateOnly(voucher.bankDate) : null,
          reconciliationRemarks: voucher.reconciliationRemarks,
          isDishonored: Boolean(voucher.isDishonored),
          reversalNumber: voucher.reversalNumber,
        });
        continue;
      }

      for (const item of voucher.items ?? []) {
        if (!bankIdSet.has(item.accountId)) continue;
        const amount = Number(item.amount ?? 0);
        if (!Number.isFinite(amount) || amount <= 0) continue;
        const isReceipt = item.direction === VoucherEntryDirection.DEBIT;
        const itemSnapshot = item.accountSnapshot as Record<
          string,
          unknown
        > | null;
        rows.push({
          sourceType: BankReconciliationSourceType.ACCOUNTING_VOUCHER,
          sourceId: voucher.id,
          section: isReceipt
            ? BankReconciliationSection.RECEIVED_NOT_DEPOSITED
            : BankReconciliationSection.ISSUED_NOT_PRESENTED,
          branchCode:
            getSnapshotCode(branchSnapshot) ||
            toText(voucher.branchId).slice(0, 8),
          docType: voucher.voucherType,
          docNumber: toText(voucher.number),
          docDate: toDateOnly(voucher.transactionDate),
          passengerName,
          amount: amountString(item.amount),
          chequeNo: toText(voucher.chequeNumber),
          chequeDate: toDateOnly(voucher.chequeDate),
          bankCode:
            getSnapshotCode(itemSnapshot) ||
            toText(input.bankCodeById.get(item.accountId)),
          bankDate: voucher.bankDate ? toDateOnly(voucher.bankDate) : null,
          reconciliationRemarks: voucher.reconciliationRemarks,
          isDishonored: Boolean(voucher.isDishonored),
          reversalNumber: voucher.reversalNumber,
        });
      }
    }

    return rows;
  }
}
