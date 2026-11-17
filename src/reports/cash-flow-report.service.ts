import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import * as XLSX from "xlsx";
import { AccountProfile } from "../account-profiles/account-profile.entity";
import { AdditionalSettingService } from "../additional-settings/additional-setting.service";
import { SessionContext } from "../auth/types/session-context";
import { Branch } from "../branches/branch.entity";
import {
  TransactionPostingSourceType,
} from "../transactions/transactions.enums";
import { UserRole } from "../user-roles/user-role.entity";
import { AccountPostingsCombinedQuery } from "./account-postings-combined.query";
import type { AccountPostingCombinedRow } from "./account-postings-combined.types";
import { CardSettlementReportFormat } from "./dto/card-settlement-report-query.dto";
import {
  CashFlowReportQueryDto,
  CashFlowReportScope,
} from "./dto/cash-flow-report-query.dto";
import { resolveFlmAccessibleBranchIds } from "./flm-report-access.helpers";

type ReportColumn = { key: string; label: string };

type AmountTriple = {
  bankCents: number;
  cashCents: number;
};

type FlowLine = {
  description: string;
  bankCents: number;
  cashCents: number;
};

type FlowMovement = {
  branchId: string;
  branchLabel: string;
  ledger: "bank" | "cash";
  amountCents: number;
  isReceipt: boolean;
  contraAccountId: string | null;
  description: string;
  isInterBranch: boolean;
};

type SectionBlock = {
  lines: Array<{
    description: string;
    bank: string;
    cash: string;
    total: string;
  }>;
  total: { bank: string; cash: string; total: string };
};

type ReportSection = {
  branchId: string | null;
  branchLabel: string;
  opening: { bank: string; cash: string; total: string };
  additions: SectionBlock;
  interBranch: SectionBlock;
  deductions: SectionBlock;
  closing: { bank: string; cash: string; total: string };
};

type DocKey = string;

const COLUMNS: ReportColumn[] = [
  { key: "description", label: "Description" },
  { key: "bank", label: "Bank" },
  { key: "cash", label: "Cash" },
  { key: "total", label: "Total" },
];

const UNCLASSIFIED = "UNCLASSIFIED";
const INTER_BRANCH_TRANSFER_OUT = "AMOUNT TRANSFER TO BRANCHES";
const INTER_BRANCH_TRANSFER_IN = "AMOUNT RECEIVED FROM BRANCHES";

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

const parseSnapshot = (
  value: unknown,
): Record<string, unknown> | null => {
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

/** Prefer account name only (matches SS Description column). */
const getSnapshotAccountName = (
  snapshot: Record<string, unknown> | null | undefined,
) => {
  if (!snapshot) return "";
  const code = toText(snapshot.code ?? snapshot.accountCode);
  const accountName = toText(snapshot.accountName);
  const name = toText(snapshot.name);
  const label = toText(snapshot.label);

  const stripCodePrefix = (value: string) => {
    if (code && value.toUpperCase().startsWith(code.toUpperCase())) {
      return value.slice(code.length).replace(/^\s*-\s*/, "").trim();
    }
    if (value.includes(" - ")) {
      return value.split(" - ").slice(1).join(" - ").trim();
    }
    return value;
  };

  if (accountName) return accountName;
  if (name && name !== code) return stripCodePrefix(name);
  if (label) {
    const stripped = stripCodePrefix(label);
    if (stripped) return stripped;
  }
  return name || label || code;
};

const getPartyFallbackName = (
  snapshot: Record<string, unknown> | null | undefined,
) => {
  if (!snapshot) return "";
  return (
    toText(snapshot.name) ||
    toText(snapshot.label) ||
    toText(snapshot.code) ||
    ""
  );
};

const isCashLedgerAccount = (account: AccountProfile) => {
  const tokens = [account.accountType?.value, account.accountType?.label].map(
    normalizeUpper,
  );
  return tokens.includes("CASH_LEDGER");
};

const isBankLedgerAccount = (account: AccountProfile) => {
  const tokens = [account.accountType?.value, account.accountType?.label].map(
    normalizeUpper,
  );
  return tokens.includes("BANK_LEDGER");
};

const emptyTriple = (): AmountTriple => ({ bankCents: 0, cashCents: 0 });

const addToTriple = (
  target: AmountTriple,
  ledger: "bank" | "cash",
  amountCents: number,
) => {
  if (ledger === "bank") target.bankCents += amountCents;
  else target.cashCents += amountCents;
};

const formatTriple = (value: AmountTriple) => ({
  bank: money(value.bankCents),
  cash: money(value.cashCents),
  total: money(value.bankCents + value.cashCents),
});

const docKeyOf = (row: Pick<AccountPostingCombinedRow, "documentKind" | "documentId">) =>
  `${row.documentKind}:${row.documentId}`;

@Injectable()
export class CashFlowReportService {
  constructor(
    @InjectRepository(AccountProfile)
    private readonly accountRepository: Repository<AccountProfile>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
    @InjectDataSource("database2")
    private readonly dataSource: DataSource,
    private readonly accountPostingsQuery: AccountPostingsCombinedQuery,
    private readonly additionalSettings: AdditionalSettingService,
  ) {}

  async buildReport(
    query: CashFlowReportQueryDto,
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

    const scope = query.scope ?? CashFlowReportScope.BRANCH;
    const branchIds = await resolveFlmAccessibleBranchIds(
      this.userRoleRepository,
      query.branchIds ?? [],
      session,
    );
    const counterIds = (query.counterIds ?? []).filter(Boolean);

    const { bankAccounts, cashAccounts, selectedIds } =
      await this.resolveLedgerAccounts(query.accountIds);
    if (!selectedIds.length) {
      return {
        startDate,
        endDate,
        scope,
        message:
          "No bank or cash ledger accounts available for the selected filters.",
        columns: COLUMNS.map((column) => ({ ...column })),
        sections: [] as ReportSection[],
      };
    }

    const bankIdSet = new Set(bankAccounts.map((account) => account.id));
    const cashIdSet = new Set(cashAccounts.map((account) => account.id));
    const selectedIdSet = new Set(selectedIds);
    const branchLabelById = await this.resolveBranchLabels(branchIds);
    const branchControlAccountId = await this.resolveBranchControlAccountId();
    const accountNameById = await this.resolveAccountNames([
      ...selectedIds,
      ...(branchControlAccountId ? [branchControlAccountId] : []),
    ]);

    const [openingMovements, periodMovements] = await Promise.all([
      this.collectMovements({
        selectedIds,
        selectedIdSet,
        bankIdSet,
        cashIdSet,
        branchIds,
        counterIds,
        branchLabelById,
        branchControlAccountId,
        accountNameById,
        beforeDate: startDate,
      }),
      this.collectMovements({
        selectedIds,
        selectedIdSet,
        bankIdSet,
        cashIdSet,
        branchIds,
        counterIds,
        branchLabelById,
        branchControlAccountId,
        accountNameById,
        startDate,
        endDate,
      }),
    ]);

    const sections = this.buildSections({
      scope,
      openingMovements,
      periodMovements,
      branchLabelById,
    });

    return {
      startDate,
      endDate,
      scope,
      message: sections.length
        ? ""
        : "No cash flow data for the selected filters.",
      columns: COLUMNS.map((column) => ({ ...column })),
      sections,
    };
  }

  async buildExport(
    query: CashFlowReportQueryDto,
    format: CardSettlementReportFormat,
    session?: SessionContext,
  ) {
    const report = await this.buildReport(query, session);
    const header = report.columns.map((column) => column.label);
    const body: string[][] = [];

    for (const section of report.sections) {
      if (section.branchLabel) {
        body.push([section.branchLabel, "", "", ""]);
      }
      body.push([
        "Opening Balance",
        section.opening.bank,
        section.opening.cash,
        section.opening.total,
      ]);
      body.push(["[+] Additions / Receipts", "", "", ""]);
      for (const line of section.additions.lines) {
        body.push([line.description, line.bank, line.cash, line.total]);
      }
      body.push([
        "Total Addition / Receipts",
        section.additions.total.bank,
        section.additions.total.cash,
        section.additions.total.total,
      ]);
      body.push(["Inter Branch Fund Transfer", "", "", ""]);
      for (const line of section.interBranch.lines) {
        body.push([line.description, line.bank, line.cash, line.total]);
      }
      body.push([
        "Total Inter Branch",
        section.interBranch.total.bank,
        section.interBranch.total.cash,
        section.interBranch.total.total,
      ]);
      body.push(["[-] Deductions / Payments", "", "", ""]);
      for (const line of section.deductions.lines) {
        body.push([line.description, line.bank, line.cash, line.total]);
      }
      body.push([
        "Total Deductions / Payments",
        section.deductions.total.bank,
        section.deductions.total.cash,
        section.deductions.total.total,
      ]);
      body.push([
        "Closing (Cash Flow)",
        section.closing.bank,
        section.closing.cash,
        section.closing.total,
      ]);
      body.push(["", "", "", ""]);
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

  private async resolveBranchControlAccountId() {
    try {
      return await this.additionalSettings.getSettingTextValue(
        "TRANSACTION_ACCOUNTING",
        "BRANCH_CONTROL_ACCOUNT",
      );
    } catch {
      return null;
    }
  }

  private async resolveLedgerAccounts(accountIds?: string[]) {
    const accounts = await this.accountRepository.find({
      where: { active: true },
      relations: ["accountType"],
    });
    let bankAccounts = accounts.filter(isBankLedgerAccount);
    let cashAccounts = accounts.filter(isCashLedgerAccount);
    if (accountIds?.length) {
      const selected = new Set(accountIds);
      bankAccounts = bankAccounts.filter((account) => selected.has(account.id));
      cashAccounts = cashAccounts.filter((account) => selected.has(account.id));
    }
    const selectedIds = [
      ...bankAccounts.map((account) => account.id),
      ...cashAccounts.map((account) => account.id),
    ];
    return { bankAccounts, cashAccounts, selectedIds };
  }

  private async resolveAccountNames(accountIds: string[]) {
    const uniqueIds = [...new Set(accountIds.filter(Boolean))];
    if (!uniqueIds.length) return new Map<string, string>();
    // Include soft-deleted accounts so historical postings still resolve names.
    const accounts = await this.accountRepository
      .createQueryBuilder("account")
      .withDeleted()
      .select(["account.id", "account.accountCode", "account.accountName"])
      .where("account.id IN (:...ids)", { ids: uniqueIds })
      .getMany();
    return new Map(
      accounts.map((account) => [
        account.id,
        toText(account.accountName) ||
          toText(account.accountCode) ||
          account.id,
      ]),
    );
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

  private resolveLedger(
    accountId: string,
    bankIdSet: Set<string>,
    cashIdSet: Set<string>,
  ): "bank" | "cash" | null {
    if (bankIdSet.has(accountId)) return "bank";
    if (cashIdSet.has(accountId)) return "cash";
    return null;
  }

  private async collectMovements(input: {
    selectedIds: string[];
    selectedIdSet: Set<string>;
    bankIdSet: Set<string>;
    cashIdSet: Set<string>;
    branchIds: string[];
    counterIds: string[];
    branchLabelById: Map<string, string>;
    branchControlAccountId: string | null;
    accountNameById: Map<string, string>;
    startDate?: string;
    endDate?: string;
    beforeDate?: string;
  }) {
    const cashBankRows = await this.accountPostingsQuery.list({
      branchIds: input.branchIds.length ? input.branchIds : undefined,
      accountIds: input.selectedIds,
      startDate: input.startDate,
      endDate: input.endDate,
      beforeDate: input.beforeDate,
    });

    if (!cashBankRows.length) return [] as FlowMovement[];

    const allowedDocumentIds = input.counterIds.length
      ? await this.resolveDocumentsForCounters(
          cashBankRows,
          input.counterIds,
        )
      : null;

    const filteredCashBankRows = allowedDocumentIds
      ? cashBankRows.filter((row) =>
          allowedDocumentIds.has(docKeyOf(row)),
        )
      : cashBankRows;

    if (!filteredCashBankRows.length) return [] as FlowMovement[];

    const documentIdsByKind = {
      TRANSACTION: new Set<string>(),
      VOUCHER: new Set<string>(),
    };
    for (const row of filteredCashBankRows) {
      documentIdsByKind[row.documentKind].add(row.documentId);
    }

    const siblingRows = await this.loadDocumentPostings(documentIdsByKind);
    const siblingsByDoc = new Map<DocKey, AccountPostingCombinedRow[]>();
    for (const row of siblingRows) {
      const key = docKeyOf(row);
      const list = siblingsByDoc.get(key) ?? [];
      list.push(row);
      siblingsByDoc.set(key, list);
    }

    // Resolve names for every sibling account (snapshot alone is often incomplete).
    const siblingAccountIds = [
      ...new Set(siblingRows.map((row) => row.accountId).filter(Boolean)),
    ].filter((id) => !input.accountNameById.has(id));
    if (siblingAccountIds.length) {
      const resolved = await this.resolveAccountNames(siblingAccountIds);
      for (const [id, name] of resolved.entries()) {
        input.accountNameById.set(id, name);
      }
    }

    const voucherIdsNeedingItems = [
      ...new Set(
        filteredCashBankRows
          .filter((row) => row.documentKind === "VOUCHER")
          .filter((row) => {
            const siblings = siblingsByDoc.get(docKeyOf(row)) ?? [];
            return !siblings.some(
              (sibling) =>
                sibling.postingId !== row.postingId &&
                sibling.accountId !== row.accountId,
            );
          })
          .map((row) => row.documentId),
      ),
    ];
    const voucherItemContrasByVoucherId =
      await this.loadVoucherItemContras(voucherIdsNeedingItems);
    const voucherItemAccountIds = [
      ...new Set(
        [...voucherItemContrasByVoucherId.values()]
          .flat()
          .map((item) => item.accountId)
          .filter((id) => id && !input.accountNameById.has(id)),
      ),
    ];
    if (voucherItemAccountIds.length) {
      const resolved = await this.resolveAccountNames(voucherItemAccountIds);
      for (const [id, name] of resolved.entries()) {
        input.accountNameById.set(id, name);
      }
    }

    const movements: FlowMovement[] = [];
    for (const cashBankRow of filteredCashBankRows) {
      const ledger = this.resolveLedger(
        cashBankRow.accountId,
        input.bankIdSet,
        input.cashIdSet,
      );
      if (!ledger) continue;
      const amountCents = cents(cashBankRow.amount);
      if (amountCents <= 0) continue;

      const isReceipt = normalizeUpper(cashBankRow.direction) === "DEBIT";
      const branchLabel =
        input.branchLabelById.get(cashBankRow.branchId) ||
        cashBankRow.branchId;
      if (!input.branchLabelById.has(cashBankRow.branchId)) {
        input.branchLabelById.set(cashBankRow.branchId, branchLabel);
      }

      const siblings = siblingsByDoc.get(docKeyOf(cashBankRow)) ?? [];
      let contras = this.resolveContraRows(
        cashBankRow,
        siblings,
        input.selectedIdSet,
      );

      if (
        !contras.length &&
        cashBankRow.documentKind === "VOUCHER"
      ) {
        const itemContras =
          voucherItemContrasByVoucherId.get(cashBankRow.documentId) ?? [];
        contras = itemContras.filter(
          (item) =>
            item.accountId !== cashBankRow.accountId &&
            (!input.selectedIdSet.has(item.accountId) ||
              item.accountId !== cashBankRow.accountId),
        );
        if (!contras.length) {
          contras = itemContras.filter(
            (item) => item.accountId !== cashBankRow.accountId,
          );
        }
      }

      if (!contras.length) {
        const fallbackDescription =
          getPartyFallbackName(cashBankRow.partySnapshot) ||
          toText(cashBankRow.narration) ||
          toText(cashBankRow.documentType) ||
          UNCLASSIFIED;
        movements.push({
          branchId: cashBankRow.branchId,
          branchLabel,
          ledger,
          amountCents,
          isReceipt,
          contraAccountId: null,
          description: fallbackDescription,
          isInterBranch: false,
        });
        continue;
      }

      const contraTotal = contras.reduce(
        (sum, row) => sum + cents(row.amount),
        0,
      );
      let allocated = 0;
      contras.forEach((contra, index) => {
        const contraCents = cents(contra.amount);
        const share =
          index === contras.length - 1
            ? amountCents - allocated
            : contraTotal > 0
              ? Math.round((amountCents * contraCents) / contraTotal)
              : Math.round(amountCents / contras.length);
        allocated += share;
        if (share === 0) return;

        const isInterBranch =
          Boolean(input.branchControlAccountId) &&
          contra.accountId === input.branchControlAccountId;

        const description = isInterBranch
          ? isReceipt
            ? INTER_BRANCH_TRANSFER_IN
            : INTER_BRANCH_TRANSFER_OUT
          : this.resolveDescription(
              contra,
              input.accountNameById,
              cashBankRow,
            );

        movements.push({
          branchId: cashBankRow.branchId,
          branchLabel,
          ledger,
          amountCents: share,
          isReceipt,
          contraAccountId: contra.accountId,
          description,
          isInterBranch,
        });
      });
    }

    return movements;
  }

  private async loadVoucherItemContras(voucherIds: string[]) {
    const map = new Map<string, AccountPostingCombinedRow[]>();
    if (!voucherIds.length) return map;

    const rows = await this.dataSource.query(
      `
        SELECT
          item.voucher_id::text AS "voucherId",
          item.id::text AS "itemId",
          item.account_id::text AS "accountId",
          item.account_snapshot AS "accountSnapshot",
          item.amount::text AS "amount",
          item.direction::text AS "direction"
        FROM accounting_voucher_items item
        WHERE item.deleted_at IS NULL
          AND item.voucher_id = ANY($1::uuid[])
      `,
      [voucherIds],
    );

    for (const row of rows as Array<Record<string, unknown>>) {
      const voucherId = toText(row.voucherId);
      const accountId = toText(row.accountId);
      if (!voucherId || !accountId) continue;
      const list = map.get(voucherId) ?? [];
      list.push({
        documentKind: "VOUCHER",
        postingId: toText(row.itemId) || `${voucherId}:${accountId}`,
        documentId: voucherId,
        documentNumber: null,
        documentType: "",
        transactionDate: "",
        branchId: "",
        accountId,
        accountSnapshot: parseSnapshot(row.accountSnapshot),
        profileId: null,
        profileSnapshot: null,
        direction:
          normalizeUpper(row.direction) === "CREDIT" ? "CREDIT" : "DEBIT",
        amount: toText(row.amount) || "0",
        remarks: null,
        lineNo: list.length + 1,
        sourceType: "ITEM",
        sourceId: toText(row.itemId) || null,
        linkedTransactionId: null,
        createdAt: "",
        partySnapshot: null,
        narration: null,
        chequeNumber: null,
        chequeDate: null,
        tradeMode: null,
      });
      map.set(voucherId, list);
    }

    return map;
  }

  private resolveContraRows(
    cashBankRow: AccountPostingCombinedRow,
    siblings: AccountPostingCombinedRow[],
    selectedIdSet: Set<string>,
  ) {
    const others = siblings.filter(
      (row) =>
        row.postingId !== cashBankRow.postingId &&
        row.accountId !== cashBankRow.accountId,
    );
    if (!others.length) return [] as AccountPostingCombinedRow[];

    if (cashBankRow.documentKind === "TRANSACTION") {
      const partyControl = others.filter(
        (row) =>
          normalizeUpper(row.sourceType) ===
            TransactionPostingSourceType.PARTY_CONTROL &&
          !selectedIdSet.has(row.accountId),
      );
      if (partyControl.length) return partyControl;

      const nonPayment = others.filter(
        (row) =>
          normalizeUpper(row.sourceType) !==
            TransactionPostingSourceType.PAYMENT &&
          !selectedIdSet.has(row.accountId),
      );
      if (nonPayment.length) {
        return [nonPayment.sort((a, b) => cents(b.amount) - cents(a.amount))[0]];
      }
    }

    // Voucher (and fallback): prefer non-selected cash/bank lines (true GL contras),
    // else allow other selected ledgers (e.g. bank ↔ petty cash).
    const nonLedger = others.filter((row) => !selectedIdSet.has(row.accountId));
    if (nonLedger.length) return nonLedger;
    return others;
  }

  private resolveDescription(
    row: AccountPostingCombinedRow,
    accountNameById: Map<string, string>,
    cashBankRow?: AccountPostingCombinedRow,
  ) {
    return (
      getSnapshotAccountName(row.accountSnapshot) ||
      accountNameById.get(row.accountId) ||
      getSnapshotAccountName(row.profileSnapshot) ||
      getPartyFallbackName(cashBankRow?.partySnapshot) ||
      toText(cashBankRow?.narration) ||
      toText(row.remarks) ||
      UNCLASSIFIED
    );
  }

  private async resolveDocumentsForCounters(
    rows: AccountPostingCombinedRow[],
    counterIds: string[],
  ) {
    const txnIds = [
      ...new Set(
        rows
          .filter((row) => row.documentKind === "TRANSACTION")
          .map((row) => row.documentId),
      ),
    ];
    const voucherIds = [
      ...new Set(
        rows
          .filter((row) => row.documentKind === "VOUCHER")
          .map((row) => row.documentId),
      ),
    ];
    const allowed = new Set<DocKey>();

    if (txnIds.length) {
      const txnRows = await this.dataSource.query(
        `
          SELECT id::text AS id
          FROM transactions
          WHERE deleted_at IS NULL
            AND id = ANY($1::uuid[])
            AND counter_id = ANY($2::uuid[])
        `,
        [txnIds, counterIds],
      );
      for (const row of txnRows as Array<{ id: string }>) {
        allowed.add(`TRANSACTION:${row.id}`);
      }
    }

    if (voucherIds.length) {
      const voucherRows = await this.dataSource.query(
        `
          SELECT id::text AS id
          FROM accounting_vouchers
          WHERE deleted_at IS NULL
            AND id = ANY($1::uuid[])
            AND counter_id = ANY($2::uuid[])
        `,
        [voucherIds, counterIds],
      );
      for (const row of voucherRows as Array<{ id: string }>) {
        allowed.add(`VOUCHER:${row.id}`);
      }
    }

    return allowed;
  }

  private async loadDocumentPostings(documentIdsByKind: {
    TRANSACTION: Set<string>;
    VOUCHER: Set<string>;
  }) {
    const txnIds = [...documentIdsByKind.TRANSACTION];
    const voucherIds = [...documentIdsByKind.VOUCHER];
    if (!txnIds.length && !voucherIds.length) {
      return [] as AccountPostingCombinedRow[];
    }

    const parts: string[] = [];
    const params: unknown[] = [];
    if (txnIds.length) {
      params.push(txnIds);
      parts.push(`
        (
          SELECT
            'TRANSACTION'::text AS "documentKind",
            posting.id::text AS "postingId",
            posting.transaction_id::text AS "documentId",
            tx.number AS "documentNumber",
            COALESCE(tx.slug, '')::text AS "documentType",
            (tx.transaction_date)::date::text AS "transactionDate",
            tx.branch_id::text AS "branchId",
            posting.account_id::text AS "accountId",
            posting.account_snapshot AS "accountSnapshot",
            posting.profile_id::text AS "profileId",
            NULL::jsonb AS "profileSnapshot",
            posting.direction::text AS "direction",
            posting.amount::text AS "amount",
            posting.remarks AS "remarks",
            posting.line_no AS "lineNo",
            posting.source_type::text AS "sourceType",
            posting.source_id::text AS "sourceId",
            NULL::uuid AS "linkedTransactionId",
            posting.created_at AS "createdAt",
            tx.party_profile_snapshot AS "partySnapshot",
            tx.remarks AS "narration",
            NULL::text AS "chequeNumber",
            NULL::text AS "chequeDate",
            tx.trade_mode::text AS "tradeMode"
          FROM transaction_account_postings posting
          INNER JOIN transactions tx ON tx.id = posting.transaction_id
          WHERE posting.deleted_at IS NULL
            AND tx.deleted_at IS NULL
            AND tx.is_latest = true
            AND tx.status = 'APPROVED'
            AND posting.transaction_id = ANY($${params.length}::uuid[])
        )
      `);
    }
    if (voucherIds.length) {
      params.push(voucherIds);
      parts.push(`
        (
          SELECT
            'VOUCHER'::text AS "documentKind",
            posting.id::text AS "postingId",
            posting.voucher_id::text AS "documentId",
            voucher.number AS "documentNumber",
            voucher.voucher_type::text AS "documentType",
            voucher.transaction_date::text AS "transactionDate",
            voucher.branch_id::text AS "branchId",
            posting.account_id::text AS "accountId",
            posting.account_snapshot AS "accountSnapshot",
            posting.profile_id::text AS "profileId",
            posting.profile_snapshot AS "profileSnapshot",
            posting.direction::text AS "direction",
            posting.amount::text AS "amount",
            posting.remarks AS "remarks",
            posting.line_no AS "lineNo",
            posting.source_type::text AS "sourceType",
            posting.source_id::text AS "sourceId",
            posting.transaction_id AS "linkedTransactionId",
            posting.created_at AS "createdAt",
            voucher.party_profile_snapshot AS "partySnapshot",
            voucher.narration AS "narration",
            voucher.cheque_number AS "chequeNumber",
            voucher.cheque_date::text AS "chequeDate",
            NULL::text AS "tradeMode"
          FROM voucher_account_postings posting
          INNER JOIN accounting_vouchers voucher ON voucher.id = posting.voucher_id
          WHERE posting.deleted_at IS NULL
            AND voucher.deleted_at IS NULL
            AND posting.voucher_id = ANY($${params.length}::uuid[])
        )
      `);
    }

    const rows = await this.dataSource.query(
      parts.join(" UNION ALL "),
      params,
    );

    return (rows as Array<Record<string, unknown>>).map((row) => ({
      documentKind:
        toText(row.documentKind).toUpperCase() === "VOUCHER"
          ? "VOUCHER"
          : "TRANSACTION",
      postingId: toText(row.postingId),
      documentId: toText(row.documentId),
      documentNumber: toText(row.documentNumber) || null,
      documentType: toText(row.documentType),
      transactionDate: toDateOnly(row.transactionDate),
      branchId: toText(row.branchId),
      accountId: toText(row.accountId),
      accountSnapshot: parseSnapshot(row.accountSnapshot),
      profileId: toText(row.profileId) || null,
      profileSnapshot: parseSnapshot(row.profileSnapshot),
      direction:
        normalizeUpper(row.direction) === "CREDIT" ? "CREDIT" : "DEBIT",
      amount: toText(row.amount) || "0",
      remarks: toText(row.remarks) || null,
      lineNo: Number(row.lineNo ?? 0) || 0,
      sourceType: toText(row.sourceType),
      sourceId: toText(row.sourceId) || null,
      linkedTransactionId: toText(row.linkedTransactionId) || null,
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : toText(row.createdAt),
      partySnapshot: parseSnapshot(row.partySnapshot),
      narration: toText(row.narration) || null,
      chequeNumber: toText(row.chequeNumber) || null,
      chequeDate: toDateOnly(row.chequeDate) || null,
      tradeMode: toText(row.tradeMode) || null,
    })) as AccountPostingCombinedRow[];
  }

  private buildSections(input: {
    scope: CashFlowReportScope;
    openingMovements: FlowMovement[];
    periodMovements: FlowMovement[];
    branchLabelById: Map<string, string>;
  }): ReportSection[] {
    const openingByBranch = new Map<string, AmountTriple>();
    for (const movement of input.openingMovements) {
      const key =
        input.scope === CashFlowReportScope.CONSOLIDATED
          ? "ALL"
          : movement.branchId;
      const opening = openingByBranch.get(key) ?? emptyTriple();
      const signed = movement.isReceipt
        ? movement.amountCents
        : -movement.amountCents;
      addToTriple(opening, movement.ledger, signed);
      openingByBranch.set(key, opening);
    }

    type Acc = {
      branchId: string | null;
      branchLabel: string;
      opening: AmountTriple;
      additions: Map<string, AmountTriple>;
      interBranch: Map<string, AmountTriple>;
      deductions: Map<string, AmountTriple>;
    };

    const sectionMap = new Map<string, Acc>();
    const ensure = (branchId: string | null, branchLabel: string) => {
      const key = branchId ?? "ALL";
      let section = sectionMap.get(key);
      if (!section) {
        section = {
          branchId,
          branchLabel,
          opening: openingByBranch.get(key) ?? emptyTriple(),
          additions: new Map(),
          interBranch: new Map(),
          deductions: new Map(),
        };
        sectionMap.set(key, section);
      }
      return section;
    };

    if (input.scope === CashFlowReportScope.CONSOLIDATED) {
      ensure(null, "ALL");
    } else {
      for (const [branchId, label] of input.branchLabelById.entries()) {
        ensure(branchId, label);
      }
      for (const movement of [
        ...input.openingMovements,
        ...input.periodMovements,
      ]) {
        ensure(movement.branchId, movement.branchLabel);
      }
    }

    const bump = (
      map: Map<string, AmountTriple>,
      description: string,
      ledger: "bank" | "cash",
      amountCents: number,
    ) => {
      const current = map.get(description) ?? emptyTriple();
      addToTriple(current, ledger, amountCents);
      map.set(description, current);
    };

    for (const movement of input.periodMovements) {
      const section =
        input.scope === CashFlowReportScope.CONSOLIDATED
          ? ensure(null, "ALL")
          : ensure(movement.branchId, movement.branchLabel);

      if (movement.isInterBranch) {
        const signed = movement.isReceipt
          ? movement.amountCents
          : -movement.amountCents;
        bump(
          section.interBranch,
          movement.description,
          movement.ledger,
          signed,
        );
        continue;
      }

      if (movement.isReceipt) {
        bump(
          section.additions,
          movement.description,
          movement.ledger,
          movement.amountCents,
        );
      } else {
        bump(
          section.deductions,
          movement.description,
          movement.ledger,
          movement.amountCents,
        );
      }
    }

    const toBlock = (map: Map<string, AmountTriple>): SectionBlock => {
      const lines: FlowLine[] = Array.from(map.entries())
        .map(([description, amounts]) => ({
          description,
          bankCents: amounts.bankCents,
          cashCents: amounts.cashCents,
        }))
        .filter((line) => line.bankCents !== 0 || line.cashCents !== 0)
        .sort((left, right) =>
          left.description.localeCompare(right.description),
        );

      const total = lines.reduce(
        (acc, line) => {
          acc.bankCents += line.bankCents;
          acc.cashCents += line.cashCents;
          return acc;
        },
        emptyTriple(),
      );

      return {
        lines: lines.map((line) => ({
          description: line.description,
          bank: money(line.bankCents),
          cash: money(line.cashCents),
          total: money(line.bankCents + line.cashCents),
        })),
        total: formatTriple(total),
      };
    };

    return Array.from(sectionMap.values())
      .map((section) => {
        const additions = toBlock(section.additions);
        const interBranch = toBlock(section.interBranch);
        const deductions = toBlock(section.deductions);
        const additionsTotal = Array.from(section.additions.values()).reduce(
          (acc, row) => {
            acc.bankCents += row.bankCents;
            acc.cashCents += row.cashCents;
            return acc;
          },
          emptyTriple(),
        );
        const interTotal = Array.from(section.interBranch.values()).reduce(
          (acc, row) => {
            acc.bankCents += row.bankCents;
            acc.cashCents += row.cashCents;
            return acc;
          },
          emptyTriple(),
        );
        const deductionsTotal = Array.from(section.deductions.values()).reduce(
          (acc, row) => {
            acc.bankCents += row.bankCents;
            acc.cashCents += row.cashCents;
            return acc;
          },
          emptyTriple(),
        );
        const closingCents: AmountTriple = {
          bankCents:
            section.opening.bankCents +
            additionsTotal.bankCents +
            interTotal.bankCents -
            deductionsTotal.bankCents,
          cashCents:
            section.opening.cashCents +
            additionsTotal.cashCents +
            interTotal.cashCents -
            deductionsTotal.cashCents,
        };

        return {
          branchId: section.branchId,
          branchLabel: section.branchLabel,
          opening: formatTriple(section.opening),
          additions,
          interBranch,
          deductions,
          closing: formatTriple(closingCents),
          _hasActivity:
            section.opening.bankCents !== 0 ||
            section.opening.cashCents !== 0 ||
            additions.lines.length > 0 ||
            interBranch.lines.length > 0 ||
            deductions.lines.length > 0 ||
            closingCents.bankCents !== 0 ||
            closingCents.cashCents !== 0,
        };
      })
      .filter((section) => section._hasActivity)
      .map(({ _hasActivity: _ignored, ...section }) => section)
      .sort((left, right) =>
        left.branchLabel.localeCompare(right.branchLabel),
      );
  }

  private toExportFile(
    startDate: string,
    endDate: string,
    format: CardSettlementReportFormat,
    header: string[],
    body: string[][],
    message: string,
  ) {
    const extension =
      format === CardSettlementReportFormat.CSV ? "csv" : "xlsx";
    const filename = `cash-flow-report-${startDate}-to-${endDate}.${extension}`;

    if (format === CardSettlementReportFormat.CSV) {
      const escape = (value: string) =>
        /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
      const csv =
        message && !body.length
          ? message
          : [
              header.join(","),
              ...body.map((row) => row.map(escape).join(",")),
            ].join("\n");
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
    XLSX.utils.book_append_sheet(workbook, sheet, "Cash Flow");
    return {
      filename,
      contentType:
        "application/vnd.openxmlformats.spreadsheetml.sheet",
      buffer: XLSX.write(workbook, {
        type: "buffer",
        bookType: "xlsx",
      }) as Buffer,
    };
  }
}
