import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import * as XLSX from "xlsx";
import { AccountProfile } from "../account-profiles/account-profile.entity";
import { Branch } from "../branches/branch.entity";
import { TransactionAccountPosting } from "../transactions/entities/transaction-account-posting.entity";
import { TransactionPayment } from "../transactions/entities/transaction-payment.entity";
import {
  TransactionPostingDirection,
  TransactionPostingSourceType,
  TransactionStatus,
  TransactionType,
} from "../transactions/transactions.enums";
import {
  GenerateLedgerFormat,
  GenerateLedgerLayout,
  GenerateLedgerQueryDto,
} from "./dto/generate-ledger-query.dto";

type ReportColumn = { key: string; label: string };

type Movement = {
  branchId: string;
  branchLabel: string;
  accountId: string;
  accountLabel: string;
  transactionDate: string;
  createdAt: string;
  lineNo: number;
  type: string;
  number: string;
  subledger: string;
  particulars: string;
  debitCents: number;
  creditCents: number;
};

type ReportRow = {
  date: string;
  type: string;
  number: string;
  subledger: string;
  particulars: string;
  debit: string;
  credit: string;
  runningTotal: string;
};

type ReportSection = {
  branchId: string | null;
  branchLabel: string;
  accountId: string | null;
  accountLabel: string;
  openingBalance: string;
  totalDebit: string;
  totalCredit: string;
  closingBalance: string;
  rows: ReportRow[];
};

const COLUMNS: ReportColumn[] = [
  { key: "date", label: "Date" },
  { key: "type", label: "Type" },
  { key: "number", label: "No" },
  { key: "subledger", label: "Subledger" },
  { key: "particulars", label: "Particulars" },
  { key: "debit", label: "Debit" },
  { key: "credit", label: "Credit" },
  { key: "runningTotal", label: "Running Total" },
];

const TECHNICAL_SLUGS = [
  "CARD_STOCK",
  "CARD_TRANSFER_OUT",
  "CARD_TRANSFER_IN",
  "CARD_STOCK_LOAD",
  "CARD_SELL",
  "CARD_SETTLE",
  "CARD_RETURN",
  "CARD_VOID",
];

const SOURCE_TYPE_LABELS: Partial<Record<string, string>> = {
  [TransactionPostingSourceType.ADDITIONAL_CHARGE]: "Additional charge",
  [TransactionPostingSourceType.TDS]: "TDS",
  [TransactionPostingSourceType.ROUND_OFF]: "Round off",
  [TransactionPostingSourceType.PARTY_CONTROL]: "Party control",
  [TransactionPostingSourceType.TAX_ITEM]: "Tax",
  [TransactionPostingSourceType.TAX_ADDITIONAL_CHARGE]: "Tax",
  [TransactionPostingSourceType.AGENT_COMMISSION]: "Agent commission",
  [TransactionPostingSourceType.ITEM_PROFIT]: "Item profit",
  [TransactionPostingSourceType.FAKE_CURRENCY]: "Fake currency",
};

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

const getSnapshotLabel = (
  snapshot: Record<string, unknown> | null | undefined,
) => {
  if (!snapshot) return "";
  const code = toText(snapshot.code);
  const name = toText(snapshot.name ?? snapshot.label);
  if (code && name) return `${code} - ${name}`;
  return name || code;
};

const getSnapshotName = (
  snapshot: Record<string, unknown> | null | undefined,
) => {
  if (!snapshot) return "";
  return toText(snapshot.name) || toText(snapshot.label) || getSnapshotLabel(snapshot);
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

const getPartyTypeLabel = (
  snapshot: Record<string, unknown> | null | undefined,
) => {
  if (!snapshot) return "";
  const entity = snapshot.entityType as Record<string, unknown> | undefined;
  const profileType = snapshot.profileType as
    | Record<string, unknown>
    | undefined;
  return (
    toText(entity?.label) ||
    toText(entity?.value) ||
    toText(profileType?.label) ||
    toText(profileType?.value) ||
    toText(snapshot.entityType) ||
    toText(snapshot.profileType)
  );
};

const isTransferTransaction = (tx: {
  transferRequestId?: string | null;
  slug?: string | null;
}) => {
  if (tx.transferRequestId) return true;
  const slug = normalizeUpper(tx.slug);
  return slug.includes("TRANSFER");
};

@Injectable()
export class GenerateLedgerService {
  constructor(
    @InjectRepository(AccountProfile)
    private readonly accountRepository: Repository<AccountProfile>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(TransactionAccountPosting, "database2")
    private readonly postingRepository: Repository<TransactionAccountPosting>,
  ) {}

  async buildReport(query: GenerateLedgerQueryDto) {
    const startDate = toDateOnly(query.startDate);
    const endDate = toDateOnly(query.endDate);
    if (!startDate || !endDate)
      throw new BadRequestException("Start date and end date are required");
    if (startDate > endDate)
      throw new BadRequestException("Start date cannot be after end date");

    const layout = query.layout ?? GenerateLedgerLayout.BRANCH_WISE;
    const accounts = await this.resolveAccounts(
      query.accountTypeIds,
      query.accountIds,
    );
    if (!accounts.length) {
      return { columns: COLUMNS, layout, sections: [] as ReportSection[] };
    }

    const accountIds = accounts.map((account) => account.id);
    const accountLabelById = new Map(
      accounts.map((account) => [
        account.id,
        `${account.accountCode} - ${account.accountName}`,
      ]),
    );
    const branchIds = (query.branchIds ?? []).filter(Boolean);
    const branchLabelById = await this.resolveBranchLabels(branchIds);

    const [openingMovements, rangeMovements] = await Promise.all([
      this.collectMovements({
        accountIds,
        accountLabelById,
        branchIds,
        branchLabelById,
        beforeDate: startDate,
      }),
      this.collectMovements({
        accountIds,
        accountLabelById,
        branchIds,
        branchLabelById,
        startDate,
        endDate,
      }),
    ]);

    const sections = this.buildSections(
      layout,
      accounts,
      openingMovements,
      rangeMovements,
      branchLabelById,
    );

    return { columns: COLUMNS, layout, sections };
  }

  async buildExport(query: GenerateLedgerQueryDto, format: GenerateLedgerFormat) {
    const report = await this.buildReport(query);
    const exportRows = report.sections.flatMap((section) => {
      const header =
        report.layout === GenerateLedgerLayout.BRANCH_WISE
          ? `${section.branchLabel} | ${section.accountLabel}`
          : "All";
      return [
        ...section.rows.map((row) => ({
          Section: header,
          Date: row.date,
          Type: row.type,
          No: row.number,
          Subledger: row.subledger,
          Particulars: row.particulars,
          Debit: row.debit,
          Credit: row.credit,
          "Running Total": row.runningTotal,
        })),
        {
          Section: header,
          Date: "",
          Type: "Summary",
          No: "",
          Subledger: "",
          Particulars: "",
          Debit: "",
          Credit: "",
          "Running Total": "",
        },
        {
          Section: header,
          Date: "",
          Type: "Opening balance",
          No: "",
          Subledger: "",
          Particulars: "",
          Debit: "",
          Credit: "",
          "Running Total": section.openingBalance,
        },
        {
          Section: header,
          Date: "",
          Type: "Total debit",
          No: "",
          Subledger: "",
          Particulars: "",
          Debit: section.totalDebit,
          Credit: "",
          "Running Total": "",
        },
        {
          Section: header,
          Date: "",
          Type: "Total credit",
          No: "",
          Subledger: "",
          Particulars: "",
          Debit: "",
          Credit: section.totalCredit,
          "Running Total": "",
        },
        {
          Section: header,
          Date: "",
          Type: "Closing balance",
          No: "",
          Subledger: "",
          Particulars: "",
          Debit: "",
          Credit: "",
          "Running Total": section.closingBalance,
        },
      ];
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Generate Ledger");

    if (format === GenerateLedgerFormat.CSV) {
      return {
        buffer: Buffer.from(XLSX.utils.sheet_to_csv(worksheet), "utf8"),
        contentType: "text/csv; charset=utf-8",
        filename: "generate-ledger.csv",
      };
    }

    return {
      buffer: XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }),
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename: "generate-ledger.xlsx",
    };
  }

  private async resolveAccounts(
    accountTypeIds?: string[],
    accountIds?: string[],
  ) {
    const qb = this.accountRepository
      .createQueryBuilder("account")
      .leftJoinAndSelect("account.accountType", "accountType")
      .where("account.active = true");

    if (accountTypeIds?.length) {
      qb.andWhere("accountType.id IN (:...accountTypeIds)", {
        accountTypeIds,
      });
    }

    if (accountIds?.length) {
      qb.andWhere("account.id IN (:...accountIds)", { accountIds });
    }

    return qb.getMany();
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
    accountIds: string[];
    accountLabelById: Map<string, string>;
    branchIds: string[];
    branchLabelById: Map<string, string>;
    startDate?: string;
    endDate?: string;
    beforeDate?: string;
  }) {
    const qb = this.postingRepository
      .createQueryBuilder("posting")
      .innerJoinAndSelect("posting.transaction", "tx")
      .leftJoinAndSelect("tx.payments", "payments")
      .where("tx.status = :status", { status: TransactionStatus.APPROVED })
      .andWhere("tx.isLatest = true")
      .andWhere("posting.accountId IN (:...accountIds)", {
        accountIds: input.accountIds,
      })
      .andWhere("COALESCE(tx.slug, '') NOT IN (:...technicalSlugs)", {
        technicalSlugs: TECHNICAL_SLUGS,
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

    qb.orderBy("tx.transactionDate", "ASC")
      .addOrderBy("tx.createdAt", "ASC")
      .addOrderBy("posting.lineNo", "ASC");

    const postings = await qb.getMany();
    const movements: Movement[] = [];

    for (const posting of postings) {
      const tx = posting.transaction;
      if (!tx) continue;

      const amountCents = cents(posting.amount);
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
      const accountSnapshot = posting.accountSnapshot as Record<
        string,
        unknown
      > | null;

      const isDebit = posting.direction === TransactionPostingDirection.DEBIT;
      const createdAt =
        posting.createdAt instanceof Date
          ? posting.createdAt.toISOString()
          : toText(posting.createdAt);

      const payment =
        posting.sourceType === TransactionPostingSourceType.PAYMENT
          ? (tx.payments ?? []).find(
              (item) => item.id === posting.sourceId,
            ) ?? null
          : null;

      movements.push({
        branchId: tx.branchId,
        branchLabel,
        accountId: posting.accountId,
        accountLabel:
          input.accountLabelById.get(posting.accountId) ||
          getSnapshotLabel(accountSnapshot),
        transactionDate: toDateOnly(tx.transactionDate),
        createdAt,
        lineNo: posting.lineNo,
        type: this.resolveTypeLabel(posting, tx, payment, isDebit),
        number: toText(tx.number),
        subledger: this.resolveSubledger(tx, partySnapshot),
        particulars: this.resolveParticulars(
          partySnapshot,
          passengerSnapshot,
          posting.remarks,
          accountSnapshot,
        ),
        debitCents: isDebit ? amountCents : 0,
        creditCents: isDebit ? 0 : amountCents,
      });
    }

    return movements.sort((left, right) => {
      const dateCompare = left.transactionDate.localeCompare(
        right.transactionDate,
      );
      if (dateCompare !== 0) return dateCompare;
      const createdCompare = left.createdAt.localeCompare(right.createdAt);
      if (createdCompare !== 0) return createdCompare;
      return left.lineNo - right.lineNo;
    });
  }

  private resolveTypeLabel(
    posting: TransactionAccountPosting,
    tx: {
      transferRequestId?: string | null;
      slug?: string | null;
      transactionType?: string;
    },
    payment: TransactionPayment | null,
    isDebit: boolean,
  ) {
    if (isTransferTransaction(tx)) {
      return "Transfer";
    }

    if (posting.sourceType === TransactionPostingSourceType.PAYMENT) {
      const direction = normalizeUpper(payment?.paymentDirection);
      if (direction === "RECEIPT") return "Receipt";
      if (direction === "PAYMENT") return "Payment";
      return isDebit ? "Receipt" : "Payment";
    }

    const sourceLabel = SOURCE_TYPE_LABELS[posting.sourceType];
    if (sourceLabel) return sourceLabel;

    if (tx.transactionType === TransactionType.PURCHASE) return "Purchase";
    if (tx.transactionType === TransactionType.SALE) return "Sale";
    return toText(tx.transactionType) || toText(posting.sourceType) || "-";
  }

  private resolveSubledger(
    tx: {
      transferRequestId?: string | null;
      slug?: string | null;
    },
    partySnapshot: Record<string, unknown> | null,
  ) {
    if (isTransferTransaction(tx)) {
      return getPartyTypeLabel(partySnapshot) || "Transfer";
    }
    return getPartyTypeLabel(partySnapshot) || "-";
  }

  private resolveParticulars(
    partySnapshot: Record<string, unknown> | null,
    passengerSnapshot: Record<string, unknown> | null,
    remarks: string | null,
    accountSnapshot: Record<string, unknown> | null,
  ) {
    if (isIndividualParty(partySnapshot)) {
      const passenger = getPassengerName(passengerSnapshot);
      if (passenger) return passenger;
    }
    const partyName = getSnapshotName(partySnapshot);
    if (partyName) return partyName;
    const remark = toText(remarks);
    if (remark) return remark;
    return getSnapshotName(accountSnapshot) || "-";
  }

  private buildSections(
    layout: GenerateLedgerLayout,
    accounts: AccountProfile[],
    openingMovements: Movement[],
    rangeMovements: Movement[],
    branchLabelById: Map<string, string>,
  ): ReportSection[] {
    if (layout === GenerateLedgerLayout.CONSOLIDATED) {
      const openingCents = openingMovements.reduce(
        (sum, movement) =>
          sum + movement.debitCents - movement.creditCents,
        0,
      );
      return [
        this.buildSectionRows({
          branchId: null,
          branchLabel: "All",
          accountId: null,
          accountLabel: "All",
          openingCents,
          movements: rangeMovements,
        }),
      ];
    }

    const openingByKey = new Map<string, number>();
    for (const movement of openingMovements) {
      const key = `${movement.branchId}::${movement.accountId}`;
      const current = openingByKey.get(key) ?? 0;
      openingByKey.set(
        key,
        current + movement.debitCents - movement.creditCents,
      );
    }

    const sectionMap = new Map<
      string,
      {
        branchId: string;
        branchLabel: string;
        accountId: string;
        accountLabel: string;
        openingCents: number;
        movements: Movement[];
      }
    >();

    const ensureSection = (
      branchId: string,
      branchLabel: string,
      accountId: string,
      accountLabel: string,
    ) => {
      const key = `${branchId}::${accountId}`;
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

    for (const movement of rangeMovements) {
      ensureSection(
        movement.branchId,
        movement.branchLabel,
        movement.accountId,
        movement.accountLabel,
      ).movements.push(movement);
    }

    for (const [key, openingCents] of openingByKey.entries()) {
      if (sectionMap.has(key)) continue;
      const [branchId, accountId] = key.split("::");
      const account = accounts.find((item) => item.id === accountId);
      if (!account) continue;
      ensureSection(
        branchId,
        branchLabelById.get(branchId) || branchId,
        accountId,
        `${account.accountCode} - ${account.accountName}`,
      ).openingCents = openingCents;
    }

    return Array.from(sectionMap.values())
      .map((section) =>
        this.buildSectionRows({
          branchId: section.branchId,
          branchLabel: section.branchLabel,
          accountId: section.accountId,
          accountLabel: section.accountLabel,
          openingCents: section.openingCents,
          movements: section.movements,
        }),
      )
      .sort((left, right) => {
        const branchCompare = left.branchLabel.localeCompare(right.branchLabel);
        if (branchCompare !== 0) return branchCompare;
        return left.accountLabel.localeCompare(right.accountLabel);
      });
  }

  private buildSectionRows(input: {
    branchId: string | null;
    branchLabel: string;
    accountId: string | null;
    accountLabel: string;
    openingCents: number;
    movements: Movement[];
  }): ReportSection {
    let running = input.openingCents;
    let totalDebitCents = 0;
    let totalCreditCents = 0;
    const rows: ReportRow[] = [
      {
        date: "",
        type: "Opening",
        number: "",
        subledger: "",
        particulars: "",
        debit: "",
        credit: "",
        runningTotal: money(running),
      },
    ];

    for (const movement of input.movements) {
      totalDebitCents += movement.debitCents;
      totalCreditCents += movement.creditCents;
      running += movement.debitCents - movement.creditCents;
      rows.push({
        date: movement.transactionDate,
        type: movement.type,
        number: movement.number,
        subledger: movement.subledger,
        particulars: movement.particulars,
        debit: movement.debitCents ? money(movement.debitCents) : "",
        credit: movement.creditCents ? money(movement.creditCents) : "",
        runningTotal: money(running),
      });
    }

    rows.push({
      date: "",
      type: "Closing",
      number: "",
      subledger: "",
      particulars: "",
      debit: "",
      credit: "",
      runningTotal: money(running),
    });

    return {
      branchId: input.branchId,
      branchLabel: input.branchLabel,
      accountId: input.accountId,
      accountLabel: input.accountLabel,
      openingBalance: money(input.openingCents),
      totalDebit: money(totalDebitCents),
      totalCredit: money(totalCreditCents),
      closingBalance: money(running),
      rows,
    };
  }
}
