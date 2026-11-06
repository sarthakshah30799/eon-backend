import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import * as XLSX from "xlsx";
import { AccountProfile } from "../account-profiles/account-profile.entity";
import { SessionContext } from "../auth/types/session-context";
import { Branch } from "../branches/branch.entity";
import {
  TransactionPostingSourceType,
  TransactionType,
} from "../transactions/transactions.enums";
import { UserRole } from "../user-roles/user-role.entity";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import {
  GeneralLedgerReportLayout,
  GeneralLedgerReportQueryDto,
  GeneralLedgerReportScope,
  GeneralLedgerReportView,
} from "./dto/general-ledger-report-query.dto";
import { resolveFlmAccessibleBranchIds } from "./flm-report-access.helpers";

type TransactionPostingRow = {
  accountId: string;
  accountSnapshot: Record<string, unknown> | null;
  direction: string;
  amount: string | number;
  remarks: string | null;
  lineNo: number;
  sourceType: string;
  createdAt: string;
  transactionDate: string;
  documentNumber: string | null;
  documentType: string;
  documentSlug: string | null;
  branchId: string;
  partySnapshot: Record<string, unknown> | null;
  tradeMode: string | null;
};

type ReportColumn = { key: string; label: string };

type Movement = {
  branchId: string;
  branchLabel: string;
  branchCode: string;
  accountId: string;
  accountCode: string;
  accountLabel: string;
  transactionDate: string;
  createdAt: string;
  lineNo: number;
  docCode: string;
  number: string;
  subledger: string;
  particulars: string;
  debitCents: number;
  creditCents: number;
};

type LedgerRow = {
  rowType: "OPENING" | "ITEM" | "CLOSING" | "TOTAL";
  date: string;
  docCode: string;
  number: string;
  subledger: string;
  particulars: string;
  debit: string;
  credit: string;
  runningTotal: string;
};

type LedgerSection = {
  branchId: string | null;
  branchLabel: string;
  accountId: string;
  accountCode: string;
  accountLabel: string;
  openingBalance: string;
  totalDebit: string;
  totalCredit: string;
  closingBalance: string;
  rows: LedgerRow[];
};

type ColumnarRow = {
  code: string;
  accountId: string;
  [key: string]: string;
};

const LEDGER_COLUMNS: ReportColumn[] = [
  { key: "date", label: "Date" },
  { key: "docCode", label: "No" },
  { key: "number", label: "ID No." },
  { key: "subledger", label: "Sub Ledger" },
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
  return (
    toText(snapshot.name) || toText(snapshot.label) || getSnapshotLabel(snapshot)
  );
};

const getSnapshotCode = (
  snapshot: Record<string, unknown> | null | undefined,
) => {
  if (!snapshot) return "";
  return toText(snapshot.code);
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

const parseSnapshot = (value: unknown): Record<string, unknown> | null => {
  if (!value) return null;
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

const isTransferDocument = (row: TransactionPostingRow) => {
  const slug = normalizeUpper(row.documentSlug || row.documentType);
  return slug.includes("TRANSFER");
};

@Injectable()
export class GeneralLedgerReportService {
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
    query: GeneralLedgerReportQueryDto,
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

    const layout = query.layout ?? GeneralLedgerReportLayout.DETAIL;
    const scope = query.scope ?? GeneralLedgerReportScope.BRANCH;
    const view = query.view ?? GeneralLedgerReportView.LEDGER;
    const accounts = await this.resolveAccounts(query.accountIds);
    const branchIds = await resolveFlmAccessibleBranchIds(
      this.userRoleRepository,
      query.branchIds ?? [],
      session,
    );

    if (!accounts.length) {
      return this.emptyResponse(startDate, endDate, layout, scope, view);
    }

    const accountIds = accounts.map((account) => account.id);
    const accountMetaById = new Map(
      accounts.map((account) => [
        account.id,
        {
          code: account.accountCode,
          label: `${account.accountCode} - ${account.accountName}`,
        },
      ]),
    );
    const branchMetaById = await this.resolveBranchMeta(branchIds);

    const passengerName = toText(query.passengerName);

    const [openingMovements, rangeMovements] = await Promise.all([
      this.collectMovements({
        accountIds,
        accountMetaById,
        branchIds,
        branchMetaById,
        beforeDate: startDate,
        passengerName,
      }),
      this.collectMovements({
        accountIds,
        accountMetaById,
        branchIds,
        branchMetaById,
        startDate,
        endDate,
        passengerName,
      }),
    ]);

    if (view === GeneralLedgerReportView.COLUMNAR) {
      return this.buildColumnarReport({
        startDate,
        endDate,
        layout,
        scope,
        accounts,
        branchIds,
        branchMetaById,
        openingMovements,
        rangeMovements,
      });
    }

    const sections = this.buildLedgerSections({
      startDate,
      endDate,
      layout,
      scope,
      accounts,
      openingMovements,
      rangeMovements,
      branchMetaById,
    });

    return {
      startDate,
      endDate,
      layout,
      scope,
      view,
      message: sections.length
        ? ""
        : "No ledger movements for the selected filters.",
      columns: LEDGER_COLUMNS.map((column) => ({ ...column })),
      sections,
      columnarColumns: [] as ReportColumn[],
      columnarRows: [] as ColumnarRow[],
    };
  }

  async buildExport(
    query: GeneralLedgerReportQueryDto,
    format: CardSettlementReportFormat,
    session?: SessionContext,
  ) {
    const report = await this.buildReport(query, session);
    if (report.view === GeneralLedgerReportView.COLUMNAR) {
      return this.buildColumnarExport(report, format);
    }
    return this.buildLedgerExport(report, format);
  }

  private emptyResponse(
    startDate: string,
    endDate: string,
    layout: GeneralLedgerReportLayout,
    scope: GeneralLedgerReportScope,
    view: GeneralLedgerReportView,
  ) {
    return {
      startDate,
      endDate,
      layout,
      scope,
      view,
      message: "No accounts available for the selected filters.",
      columns: LEDGER_COLUMNS.map((column) => ({ ...column })),
      sections: [] as LedgerSection[],
      columnarColumns: [] as ReportColumn[],
      columnarRows: [] as ColumnarRow[],
    };
  }

  private async resolveAccounts(accountIds?: string[]) {
    const qb = this.accountRepository
      .createQueryBuilder("account")
      .leftJoinAndSelect("account.subLedger", "subLedger")
      .where("account.active = true")
      .andWhere("account.deleted_at IS NULL");

    if (accountIds?.length) {
      qb.andWhere("account.id IN (:...accountIds)", { accountIds });
    }

    return qb.orderBy("account.accountCode", "ASC").getMany();
  }

  private resolveAccountSubledgerLabel(account: AccountProfile) {
    const option = account.subLedger;
    if (!option) {
      return account.accountCode;
    }
    return (
      toText(option.label) ||
      toText(option.value) ||
      account.accountCode
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

  private async collectMovements(input: {
    accountIds: string[];
    accountMetaById: Map<string, { code: string; label: string }>;
    branchIds: string[];
    branchMetaById: Map<string, { code: string; label: string }>;
    startDate?: string;
    endDate?: string;
    beforeDate?: string;
    passengerName?: string;
  }) {
    if (!input.accountIds.length) {
      return [] as Movement[];
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

    const passengerName = toText(input.passengerName);
    if (passengerName) {
      params.push(`%${passengerName}%`);
      conditions.push(`(
        COALESCE(tx.passenger_snapshot->>'passportPassengerName', '') ILIKE $${params.length}
        OR COALESCE(tx.passenger_snapshot->>'panHolderName', '') ILIKE $${params.length}
        OR COALESCE(tx.passenger_snapshot->>'paidByPanHolderName', '') ILIKE $${params.length}
        OR COALESCE(tx.passenger_snapshot->>'name', '') ILIKE $${params.length}
      )`);
    }

    const rows = (await this.database2.query(
      `SELECT
          posting.account_id AS "accountId",
          posting.account_snapshot AS "accountSnapshot",
          posting.direction AS "direction",
          posting.amount AS "amount",
          posting.remarks AS "remarks",
          posting.line_no AS "lineNo",
          posting.source_type AS "sourceType",
          posting.created_at AS "createdAt",
          tx.transaction_date AS "transactionDate",
          tx.number AS "documentNumber",
          tx.transaction_type AS "documentType",
          tx.slug AS "documentSlug",
          tx.branch_id AS "branchId",
          tx.party_profile_snapshot AS "partySnapshot",
          tx.trade_mode AS "tradeMode"
        FROM transaction_account_postings posting
        INNER JOIN transactions tx ON tx.id = posting.transaction_id
        WHERE ${conditions.join(" AND ")}
        ORDER BY
          tx.transaction_date ASC,
          posting.created_at ASC,
          tx.number ASC,
          posting.line_no ASC`,
      params,
    )) as Array<Record<string, unknown>>;

    const movements: Movement[] = [];

    for (const raw of rows) {
      const posting: TransactionPostingRow = {
        accountId: toText(raw.accountId),
        accountSnapshot: parseSnapshot(raw.accountSnapshot),
        direction: toText(raw.direction).toUpperCase(),
        amount: (raw.amount as string | number) ?? 0,
        remarks: toText(raw.remarks) || null,
        lineNo: Number(raw.lineNo ?? 0) || 0,
        sourceType: toText(raw.sourceType),
        createdAt:
          raw.createdAt instanceof Date
            ? raw.createdAt.toISOString()
            : toText(raw.createdAt),
        transactionDate: toDateOnly(raw.transactionDate),
        documentNumber: toText(raw.documentNumber) || null,
        documentType: toText(raw.documentType),
        documentSlug: toText(raw.documentSlug) || null,
        branchId: toText(raw.branchId),
        partySnapshot: parseSnapshot(raw.partySnapshot),
        tradeMode: toText(raw.tradeMode) || null,
      };

      if (TECHNICAL_SLUGS.includes(normalizeUpper(posting.documentSlug))) {
        continue;
      }

      const amountCents = cents(posting.amount);
      if (amountCents <= 0) continue;

      const branchMeta = input.branchMetaById.get(posting.branchId) ?? {
        code: posting.branchId,
        label: posting.branchId,
      };
      if (!input.branchMetaById.has(posting.branchId)) {
        input.branchMetaById.set(posting.branchId, branchMeta);
      }

      const accountMeta = input.accountMetaById.get(posting.accountId) ?? {
        code: getSnapshotCode(posting.accountSnapshot) || posting.accountId,
        label:
          getSnapshotLabel(posting.accountSnapshot) || posting.accountId,
      };
      const isDebit = posting.direction === "DEBIT";
      const partySnapshot = posting.partySnapshot;

      movements.push({
        branchId: posting.branchId,
        branchLabel: branchMeta.label,
        branchCode: branchMeta.code,
        accountId: posting.accountId,
        accountCode: accountMeta.code,
        accountLabel: accountMeta.label,
        transactionDate: posting.transactionDate,
        createdAt: posting.createdAt,
        lineNo: posting.lineNo,
        docCode: this.resolveDocCode(posting, isDebit),
        number: toText(posting.documentNumber),
        subledger: this.resolveSubledger(posting, partySnapshot),
        particulars: this.resolveParticulars(
          partySnapshot,
          posting.remarks,
          posting.accountSnapshot,
        ),
        debitCents: isDebit ? amountCents : 0,
        creditCents: isDebit ? 0 : amountCents,
      });
    }

    return movements;
  }

  private resolveDocCode(row: TransactionPostingRow, isDebit: boolean) {
    if (isTransferDocument(row)) return "TR";

    if (row.sourceType === TransactionPostingSourceType.PAYMENT) {
      return isDebit ? "RT" : "PT";
    }

    const documentType = normalizeUpper(row.documentType);
    if (
      documentType === TransactionType.PURCHASE ||
      documentType.includes("PURCHASE")
    ) {
      return "PR";
    }
    if (
      documentType === TransactionType.SALE ||
      documentType.includes("SALE") ||
      documentType.includes("SELL")
    ) {
      return "SL";
    }
    return toText(row.documentType).slice(0, 2).toUpperCase() || "-";
  }

  private resolveSubledger(
    row: TransactionPostingRow,
    partySnapshot: Record<string, unknown> | null,
  ) {
    if (isTransferDocument(row)) {
      return getPartyTypeLabel(partySnapshot) || "Transfer";
    }
    return getPartyTypeLabel(partySnapshot) || "-";
  }

  private resolveParticulars(
    partySnapshot: Record<string, unknown> | null,
    remarks: string | null,
    accountSnapshot: Record<string, unknown> | null,
  ) {
    const partyName = getSnapshotName(partySnapshot);
    if (partyName) return partyName;
    const remark = toText(remarks);
    if (remark) return remark;
    return getSnapshotName(accountSnapshot) || "-";
  }

  private buildLedgerSections(input: {
    startDate: string;
    endDate: string;
    layout: GeneralLedgerReportLayout;
    scope: GeneralLedgerReportScope;
    accounts: AccountProfile[];
    openingMovements: Movement[];
    rangeMovements: Movement[];
    branchMetaById: Map<string, { code: string; label: string }>;
  }): LedgerSection[] {
    const accountSubledgerById = new Map(
      input.accounts.map((account) => [
        account.id,
        this.resolveAccountSubledgerLabel(account),
      ]),
    );

    const sectionMap = new Map<
      string,
      {
        branchId: string | null;
        branchLabel: string;
        accountId: string;
        accountCode: string;
        accountLabel: string;
        accountSubledger: string;
        openingCents: number;
        movements: Movement[];
      }
    >();

    const keyOf = (branchId: string | null, accountId: string) =>
      `${branchId ?? "ALL"}::${accountId}`;

    const ensure = (
      branchId: string | null,
      branchLabel: string,
      accountId: string,
      accountCode: string,
      accountLabel: string,
      openingCents = 0,
    ) => {
      const key = keyOf(branchId, accountId);
      let section = sectionMap.get(key);
      if (!section) {
        section = {
          branchId,
          branchLabel,
          accountId,
          accountCode,
          accountLabel,
          accountSubledger:
            accountSubledgerById.get(accountId) || accountCode,
          openingCents,
          movements: [],
        };
        sectionMap.set(key, section);
      }
      return section;
    };

    if (input.scope === GeneralLedgerReportScope.CONSOLIDATED) {
      const openingByAccount = new Map<string, number>();
      for (const movement of input.openingMovements) {
        openingByAccount.set(
          movement.accountId,
          (openingByAccount.get(movement.accountId) ?? 0) +
            movement.debitCents -
            movement.creditCents,
        );
      }

      for (const account of input.accounts) {
        ensure(
          null,
          "All",
          account.id,
          account.accountCode,
          `${account.accountCode} - ${account.accountName}`,
          openingByAccount.get(account.id) ?? 0,
        );
      }

      for (const movement of input.rangeMovements) {
        ensure(
          null,
          "All",
          movement.accountId,
          movement.accountCode,
          movement.accountLabel,
          openingByAccount.get(movement.accountId) ?? 0,
        ).movements.push(movement);
      }
    } else {
      const openingByKey = new Map<string, number>();
      for (const movement of input.openingMovements) {
        const key = keyOf(movement.branchId, movement.accountId);
        openingByKey.set(
          key,
          (openingByKey.get(key) ?? 0) +
            movement.debitCents -
            movement.creditCents,
        );
      }

      for (const movement of input.rangeMovements) {
        ensure(
          movement.branchId,
          movement.branchCode || movement.branchLabel,
          movement.accountId,
          movement.accountCode,
          movement.accountLabel,
          openingByKey.get(keyOf(movement.branchId, movement.accountId)) ?? 0,
        ).movements.push(movement);
      }

      for (const [key, openingCents] of openingByKey.entries()) {
        if (sectionMap.has(key)) continue;
        const [branchId, accountId] = key.split("::");
        const account = input.accounts.find((item) => item.id === accountId);
        if (!account) continue;
        const branchMeta = input.branchMetaById.get(branchId);
        ensure(
          branchId,
          branchMeta?.code || branchMeta?.label || branchId,
          accountId,
          account.accountCode,
          `${account.accountCode} - ${account.accountName}`,
          openingCents,
        );
      }
    }

    return Array.from(sectionMap.values())
      .filter(
        (section) =>
          section.movements.length > 0 ||
          Math.abs(section.openingCents) > 0,
      )
      .map((section) =>
        this.buildSectionRows({
          ...section,
          startDate: input.startDate,
          endDate: input.endDate,
          layout: input.layout,
        }),
      )
      .sort((left, right) => {
        const branchCompare = left.branchLabel.localeCompare(right.branchLabel);
        if (branchCompare !== 0) return branchCompare;
        return left.accountCode.localeCompare(right.accountCode);
      });
  }

  private buildSectionRows(input: {
    branchId: string | null;
    branchLabel: string;
    accountId: string;
    accountCode: string;
    accountLabel: string;
    accountSubledger: string;
    openingCents: number;
    movements: Movement[];
    startDate: string;
    endDate: string;
    layout: GeneralLedgerReportLayout;
  }): LedgerSection {
    let running = input.openingCents;
    let periodDebitCents = 0;
    let periodCreditCents = 0;
    const openingDebitCents =
      input.openingCents > 0 ? input.openingCents : 0;
    const openingCreditCents =
      input.openingCents < 0 ? Math.abs(input.openingCents) : 0;
    const balanceSubledger = input.accountSubledger || input.accountCode;

    const rows: LedgerRow[] = [
      {
        rowType: "OPENING",
        date: input.startDate,
        docCode: "OP",
        number: "OPN",
        subledger: balanceSubledger,
        particulars: "OPENING BAL",
        debit:
          input.openingCents >= 0
            ? money(input.openingCents)
            : money(0),
        credit:
          input.openingCents < 0
            ? money(Math.abs(input.openingCents))
            : money(0),
        runningTotal: money(running),
      },
    ];

    if (input.layout === GeneralLedgerReportLayout.DETAIL) {
      for (const movement of input.movements) {
        periodDebitCents += movement.debitCents;
        periodCreditCents += movement.creditCents;
        running += movement.debitCents - movement.creditCents;
        rows.push({
          rowType: "ITEM",
          date: movement.transactionDate,
          docCode: movement.docCode,
          number: movement.number,
          subledger: movement.subledger,
          particulars: movement.particulars,
          debit: movement.debitCents ? money(movement.debitCents) : money(0),
          credit: movement.creditCents ? money(movement.creditCents) : money(0),
          runningTotal: money(running),
        });
      }
    } else {
      for (const movement of input.movements) {
        periodDebitCents += movement.debitCents;
        periodCreditCents += movement.creditCents;
        running += movement.debitCents - movement.creditCents;
      }
    }

    const closingDebitCents = running > 0 ? running : 0;
    const closingCreditCents = running < 0 ? Math.abs(running) : 0;
    // Balance the total columns by placing closing on the opposite side.
    const totalDebitCents =
      openingDebitCents + periodDebitCents + closingCreditCents;
    const totalCreditCents =
      openingCreditCents + periodCreditCents + closingDebitCents;

    rows.push({
      rowType: "CLOSING",
      date: input.endDate,
      docCode: "CL",
      number: "CL",
      subledger: balanceSubledger,
      particulars: "CLOSING BAL",
      debit: money(0),
      credit: money(0),
      runningTotal: money(running),
    });

    rows.push({
      rowType: "TOTAL",
      date: "",
      docCode: "",
      number: "",
      subledger: "",
      particulars: "",
      debit: money(totalDebitCents),
      credit: money(totalCreditCents),
      runningTotal: money(0),
    });

    return {
      branchId: input.branchId,
      branchLabel: input.branchLabel,
      accountId: input.accountId,
      accountCode: input.accountCode,
      accountLabel: input.accountLabel,
      openingBalance: money(input.openingCents),
      totalDebit: money(totalDebitCents),
      totalCredit: money(totalCreditCents),
      closingBalance: money(running),
      rows,
    };
  }

  private buildColumnarReport(input: {
    startDate: string;
    endDate: string;
    layout: GeneralLedgerReportLayout;
    scope: GeneralLedgerReportScope;
    accounts: AccountProfile[];
    branchIds: string[];
    branchMetaById: Map<string, { code: string; label: string }>;
    openingMovements: Movement[];
    rangeMovements: Movement[];
  }) {
    const closingByAccountBranch = new Map<string, number>();
    const bump = (accountId: string, branchId: string, delta: number) => {
      const key = `${accountId}::${branchId}`;
      closingByAccountBranch.set(
        key,
        (closingByAccountBranch.get(key) ?? 0) + delta,
      );
    };

    for (const movement of input.openingMovements) {
      bump(
        movement.accountId,
        movement.branchId,
        movement.debitCents - movement.creditCents,
      );
    }
    for (const movement of input.rangeMovements) {
      bump(
        movement.accountId,
        movement.branchId,
        movement.debitCents - movement.creditCents,
      );
    }

    const consolidated = input.scope === GeneralLedgerReportScope.CONSOLIDATED;
    const branchColumns = consolidated
      ? [{ key: "total", label: "Total" }]
      : (
          input.branchIds.length
            ? input.branchIds
            : Array.from(input.branchMetaById.keys())
        )
          .map((branchId) => {
            const meta = input.branchMetaById.get(branchId);
            return {
              key: `branch_${branchId}`,
              label: meta?.code || meta?.label || branchId,
              branchId,
            };
          })
          .sort((left, right) => left.label.localeCompare(right.label));

    const columnarColumns: ReportColumn[] = [
      { key: "code", label: "Code" },
      ...branchColumns.map((column) => ({
        key: column.key,
        label: column.label,
      })),
    ];

    const columnarRows: ColumnarRow[] = input.accounts.map((account) => {
      const row: ColumnarRow = {
        code: account.accountCode,
        accountId: account.id,
      };

      if (consolidated) {
        let total = 0;
        for (const [key, value] of closingByAccountBranch.entries()) {
          if (key.startsWith(`${account.id}::`)) {
            total += value;
          }
        }
        row.total = money(total);
      } else {
        for (const column of branchColumns) {
          const branchId = "branchId" in column ? column.branchId : "";
          row[column.key] = money(
            closingByAccountBranch.get(`${account.id}::${branchId}`) ?? 0,
          );
        }
      }

      return row;
    });

    return {
      startDate: input.startDate,
      endDate: input.endDate,
      layout: input.layout,
      scope: input.scope,
      view: GeneralLedgerReportView.COLUMNAR,
      message: columnarRows.length
        ? ""
        : "No closing balances for the selected filters.",
      columns: LEDGER_COLUMNS.map((column) => ({ ...column })),
      sections: [] as LedgerSection[],
      columnarColumns,
      columnarRows,
    };
  }

  private buildLedgerExport(
    report: Awaited<ReturnType<GeneralLedgerReportService["buildReport"]>>,
    format: CardSettlementReportFormat,
  ) {
    const header = report.columns.map((column) => column.label);
    const body: string[][] = [];

    for (const section of report.sections) {
      const title =
        report.scope === GeneralLedgerReportScope.BRANCH
          ? `${section.branchLabel} | ${section.accountCode}`
          : section.accountCode;
      body.push([title, "", "", "", "", "", "", ""]);
      for (const row of section.rows) {
        body.push(report.columns.map((column) => row[column.key as keyof LedgerRow] ?? ""));
      }
      body.push([]);
    }

    return this.toExportFile(
      "general-ledger-report",
      report.startDate,
      report.endDate,
      format,
      header,
      body,
      report.message,
    );
  }

  private buildColumnarExport(
    report: Awaited<ReturnType<GeneralLedgerReportService["buildReport"]>>,
    format: CardSettlementReportFormat,
  ) {
    const header = report.columnarColumns.map((column) => column.label);
    const body = report.columnarRows.map((row) =>
      report.columnarColumns.map((column) => row[column.key] ?? ""),
    );
    return this.toExportFile(
      "general-ledger-columnar",
      report.startDate,
      report.endDate,
      format,
      header,
      body,
      report.message,
    );
  }

  private toExportFile(
    prefix: string,
    startDate: string,
    endDate: string,
    format: CardSettlementReportFormat,
    header: string[],
    body: string[][],
    message: string,
  ) {
    const extension = format === CardSettlementReportFormat.CSV ? "csv" : "xlsx";
    const filename = `${prefix}-${startDate}-to-${endDate}.${extension}`;

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
    XLSX.utils.book_append_sheet(workbook, sheet, "General Ledger");
    return {
      filename,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer,
    };
  }
}
