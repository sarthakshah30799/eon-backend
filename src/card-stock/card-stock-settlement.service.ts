import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, In, Repository } from "typeorm";
import { AdditionalSettingService } from "../additional-settings/additional-setting.service";
import { AuthenticatedSession } from "../auth/types/session-context";
import { Branch } from "../branches/branch.entity";
import {
  toDateOnlyString,
  toUtcDateOnly,
  toUtcNextDate,
} from "../common/date/date.util";
import { DayEndStartProcessService } from "../day-end-start-process/day-end-start-process.service";
import { Transaction } from "../transactions/entities/transaction.entity";
import { TransactionItem } from "../transactions/entities/transaction-item.entity";
import {
  TransactionStatus,
  TransactionTypeProfileEnum,
} from "../transactions/transactions.enums";
import {
  CardStockReferenceType,
  CardStockSettlementDocumentKind,
  CardStockSettlementDocumentStatus,
  CardStockSettlementMode,
  CardStockSettlementSaleKind,
  CardStockSettlementStatus,
} from "./card-stock.enums";
import { CardStockTransactionService } from "./card-stock-transaction.service";
import {
  CancelCardStockSettlementDocumentDto,
  CardStockSettlementDocumentQueryDto,
  CardStockUnsettledQueryDto,
  CreateCardStockSettlementDocumentDto,
  RejectCardStockSettlementDocumentDto,
} from "./dto/card-stock-settlement.dto";
import { CardStockCard } from "./entities/card-stock-card.entity";
import { CardStockSettlement } from "./entities/card-stock-settlement.entity";
import { CardStockSettlementDocument } from "./entities/card-stock-settlement-document.entity";
import {
  buildPaginatedResponse,
  normalizePagination,
} from "../common/pagination";

const MASKED_CARD_SQL = `CASE WHEN length(clear_number)<=8 THEN left(clear_number,4)||repeat('X',greatest(length(clear_number)-4,0)) ELSE left(clear_number,4)||repeat('X',length(clear_number)-8)||right(clear_number,4) END`;

@Injectable()
export class CardStockSettlementService {
  private readonly logger = new Logger(CardStockSettlementService.name);
  constructor(
    @InjectDataSource("database2") private readonly database2: DataSource,
    @InjectRepository(CardStockSettlement, "database2")
    private readonly settlementRepository: Repository<CardStockSettlement>,
    @InjectRepository(CardStockSettlementDocument, "database2")
    private readonly documentRepository: Repository<CardStockSettlementDocument>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
    private readonly additionalSettingService: AdditionalSettingService,
    private readonly cardStockTransactionService: CardStockTransactionService,
    private readonly dayEndStartProcessService: DayEndStartProcessService,
  ) {}

  private isHo(session: AuthenticatedSession) {
    return Boolean(session?.isAdmin || session?.isHo || session?.isHoStaff);
  }
  private assertHo(session: AuthenticatedSession) {
    if (!session?.userId || !this.isHo(session))
      throw new ForbiddenException(
        "Only Admin/HO users can perform this action",
      );
  }
  private clean(value?: string) {
    return value?.trim() || null;
  }
  private toTimestamp(
    value: Date | string | null | undefined,
    message: string,
  ): Date {
    if (value instanceof Date && !Number.isNaN(value.getTime()))
      return new Date(value.getTime());
    const isoDate = toDateOnlyString(value);
    if (!isoDate) throw new BadRequestException(message);
    return toUtcDateOnly(isoDate);
  }
  private isCalendarBefore(
    left: Date | string | null | undefined,
    right: Date | string | null | undefined,
  ) {
    const leftDate = toDateOnlyString(left);
    const rightDate = toDateOnlyString(right);
    return Boolean(leftDate && rightDate && leftDate < rightDate);
  }
  private parseRate(value: string, message: string) {
    const rate = Number(value);
    if (!Number.isFinite(rate) || rate <= 0)
      throw new BadRequestException(message);
    return rate;
  }
  private amountFrom(denomination: string, rate: number) {
    return (Number(denomination) * rate).toFixed(2);
  }
  private resolveBuyQuote(item: TransactionItem) {
    for (const snapshot of [
      item.productCurrencyRateSnapshot,
      item.pricingRuleSnapshot,
      item.currencyRateSnapshot,
    ]) {
      const buy =
        snapshot && typeof snapshot === "object"
          ? (snapshot as Record<string, unknown>).buy
          : null;
      const rate =
        buy && typeof buy === "object"
          ? Number(
              (buy as Record<string, unknown>).finalRate ??
                (buy as Record<string, unknown>).appliedFinalRate,
            )
          : NaN;
      if (Number.isFinite(rate) && rate > 0)
        return { buyRate: rate, snapshot: snapshot as Record<string, unknown> };
    }
    throw new BadRequestException(
      `CARD item ${item.lineNo} is missing its approval-time buying-rate snapshot`,
    );
  }
  async assertPersistedBuyRates(items: TransactionItem[]) {
    for (const item of items) this.resolveBuyQuote(item);
  }

  private async getBranch(id: string) {
    const branch = await this.branchRepository.findOne({
      where: { id, isActive: true },
      relations: ["company"],
    });
    if (!branch)
      throw new NotFoundException(`Active branch ${id} was not found`);
    return branch;
  }
  private async getSettlementHo(
    receiptBranchId: string,
    sellingBranch: Branch,
  ) {
    if (sellingBranch.isHeadOffice) return sellingBranch;
    const receiptBranch = await this.branchRepository.findOne({
      where: { id: receiptBranchId, isActive: true },
      relations: ["company"],
    });
    if (receiptBranch?.isHeadOffice) return receiptBranch;
    const companyId = sellingBranch.company?.id ?? receiptBranch?.company?.id;
    const query = this.branchRepository
      .createQueryBuilder("branch")
      .leftJoinAndSelect("branch.company", "company")
      .where("branch.isHeadOffice = true AND branch.isActive = true")
      .orderBy("branch.createdAt", "ASC");
    if (companyId) query.andWhere("company.id = :companyId", { companyId });
    const ho = await query.getOne();
    if (!ho)
      throw new BadRequestException(
        "An active HO branch is required for CARD settlement",
      );
    return ho;
  }

  private async reserveNumber(branch: Branch, date: Date) {
    return this.additionalSettingService.reserveTransactionNumber(
      TransactionTypeProfileEnum.CARD_SETTLE,
      branch.code,
      date,
    );
  }

  private sortIds(ids: string[]) {
    return [...new Set(ids.filter(Boolean))].sort((left, right) =>
      left.localeCompare(right),
    );
  }

  private async lockRowsById(
    manager: EntityManager,
    table: "transactions" | "transaction_items" | "card_stock_settlements",
    ids: string[],
  ) {
    for (const id of this.sortIds(ids)) {
      await manager.query(`SELECT 1 FROM ${table} WHERE id = $1 FOR UPDATE`, [
        id,
      ]);
    }
  }

  private async lockSettlementRows(manager: EntityManager, ids: string[]) {
    const uniqueIds = this.sortIds(ids);
    if (!uniqueIds.length) return [];
    const preview: Array<{
      id: string;
      transaction_id: string;
      transaction_item_id: string;
    }> = await manager.query(
      `SELECT id, transaction_id, transaction_item_id FROM card_stock_settlements WHERE id = ANY($1::uuid[])`,
      [uniqueIds],
    );
    await this.lockRowsById(
      manager,
      "transactions",
      preview.map((row) => row.transaction_id),
    );
    await this.lockRowsById(
      manager,
      "transaction_items",
      preview.map((row) => row.transaction_item_id),
    );
    await this.lockRowsById(
      manager,
      "card_stock_settlements",
      preview.map((row) => row.id),
    );
    const rows = await manager
      .getRepository(CardStockSettlement)
      .find({ where: { id: In(uniqueIds) } });
    return rows.sort((left, right) => left.id.localeCompare(right.id));
  }

  private async createDocument(
    manager: EntityManager,
    input: {
      kind: CardStockSettlementDocumentKind;
      status: CardStockSettlementDocumentStatus;
      transactionDate: Date;
      numberBranch: Branch;
      issuerPartyProfileId: string;
      issuerPartyProfileSnapshot: CardStockSettlement["issuerPartyProfileSnapshot"];
      currencyId: string;
      currencySnapshot: CardStockSettlement["currencySnapshot"];
      branchId: string;
      branchSnapshot: CardStockSettlement["branchSnapshot"];
      hoBranchId: string;
      hoBranchSnapshot: CardStockSettlement["hoBranchSnapshot"];
      reference: string | null;
      remarks: string | null;
      actorId: string;
    },
  ) {
    const repo = manager.getRepository(CardStockSettlementDocument);
    return repo.save(
      repo.create({
        transactionNumber: await this.reserveNumber(
          input.numberBranch,
          input.transactionDate,
        ),
        transactionDate: input.transactionDate,
        kind: input.kind,
        status: input.status,
        issuerPartyProfileId: input.issuerPartyProfileId,
        issuerPartyProfileSnapshot: input.issuerPartyProfileSnapshot,
        currencyId: input.currencyId,
        currencySnapshot: input.currencySnapshot,
        branchId: input.branchId,
        branchSnapshot: input.branchSnapshot,
        hoBranchId: input.hoBranchId,
        hoBranchSnapshot: input.hoBranchSnapshot,
        reference: input.reference,
        remarks: input.remarks,
        createdBy: input.actorId,
        updatedBy: input.actorId,
      }),
    );
  }

  async createForApprovedSale(
    manager: EntityManager,
    transaction: Transaction,
    items: TransactionItem[],
    actorId: string,
  ) {
    if (transaction.status !== TransactionStatus.APPROVED)
      throw new BadRequestException(
        "CARD settlement requires an approved sale",
      );
    const sellingBranch = await this.getBranch(transaction.branchId);
    const auto = await this.additionalSettingService.getSettingBooleanValue(
      "CARD_SETTINGS",
      "AUTO_SETTLE_CARD_WITH_HO",
      true,
    );
    const repo = manager.getRepository(CardStockSettlement);
    const cardRepo = manager.getRepository(CardStockCard);
    const saleRows: CardStockSettlement[] = [];
    for (const item of items) {
      if (!item.cardId) continue;
      let row = await repo.findOne({
        where: { cardId: item.cardId, transactionItemId: item.id },
      });
      if (!row) {
        const card = await cardRepo.findOne({
          where: { id: item.cardId },
          relations: ["receiptItem", "receiptItem.receipt"],
        });
        if (!card?.receiptItem?.receipt || !item.issuerPartyProfileId)
          throw new BadRequestException(
            `CARD settlement source is incomplete for item ${item.lineNo}`,
          );
        const ho = await this.getSettlementHo(
          card.receiptItem.receipt.branchId,
          sellingBranch,
        );
        const freezeBranch = auto || sellingBranch.id === ho.id;
        const mode = freezeBranch
          ? CardStockSettlementMode.AUTO
          : CardStockSettlementMode.MANUAL;
        const balance =
          (
            await manager.query(
              `SELECT e.series
           FROM card_stock_transaction_entries e
           WHERE e.card_id=$1 AND e.reference_id=$2 AND e.currency_id=$3 AND e.operation_type='CARD_STOCK_LOAD'
           ORDER BY e.created_at DESC LIMIT 1`,
              [card.id, transaction.id, item.currencyId],
            )
          )[0] ??
          (
            await manager.query(
              `SELECT id,series FROM card_stock_balance WHERE card_id=$1 AND branch_id=$2 AND is_active=true ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
              [card.id, transaction.branchId],
            )
          )[0];
        if (!balance)
          throw new BadRequestException(
            `No active CARD balance exists for item ${item.lineNo}`,
          );
        const quote = this.resolveBuyQuote(item);
        const denomination = Number(item.quantity);
        const saleBuyRate = quote.buyRate.toFixed(7);
        const saleDate = this.toTimestamp(
          transaction.transactionDate,
          `CARD item ${item.lineNo} is missing a sale date`,
        );
        row = await repo.save(
          repo.create({
            cardId: card.id,
            transactionId: transaction.id,
            transactionItemId: item.id,
            branchId: sellingBranch.id,
            branchSnapshot: transaction.branchSnapshot,
            hoBranchId: ho.id,
            hoBranchSnapshot: {
              id: ho.id,
              code: ho.code,
              name: ho.name,
              label: `${ho.code} - ${ho.name}`,
            },
            issuerPartyProfileId: item.issuerPartyProfileId,
            issuerPartyProfileSnapshot:
              item.issuerPartyProfileSnapshot ??
              card.receiptItem.issuerPartyProfileSnapshot,
            currencyId: item.currencyId,
            currencySnapshot: item.currencySnapshot,
            productId: item.productId,
            productSnapshot: item.productSnapshot,
            passengerId: transaction.passengerId,
            passengerSnapshot: transaction.passengerSnapshot,
            series: String(balance.series),
            denomination: denomination.toFixed(2),
            saleBuyRate,
            buyRate: saleBuyRate,
            buyRateSnapshot: quote.snapshot,
            settlementAmount: (denomination * quote.buyRate).toFixed(2),
            saleDate,
            settlementMode: mode,
            saleKind: item.isReload
              ? CardStockSettlementSaleKind.RELOAD
              : CardStockSettlementSaleKind.FRESH,
            branchRequestedDate: freezeBranch ? saleDate : null,
            branchReference: null,
            branchRemarks: null,
            branchRequestedAt: freezeBranch ? new Date() : null,
            branchRequestedById: freezeBranch ? actorId : null,
            status:
              freezeBranch && sellingBranch.id !== ho.id
                ? CardStockSettlementStatus.PENDING_HO_ACCEPTANCE
                : CardStockSettlementStatus.PENDING_BRANCH_SETTLEMENT,
            createdBy: actorId,
            updatedBy: actorId,
          }),
        );
      }
      saleRows.push(row);
    }
    const frozenRows = saleRows.filter(
      (row) =>
        row.settlementMode === CardStockSettlementMode.AUTO &&
        !row.branchDocumentId,
    );
    if (frozenRows.length)
      await this.createFrozenBranchDocuments(manager, frozenRows, actorId);
  }

  private async createFrozenBranchDocuments(
    manager: EntityManager,
    rows: CardStockSettlement[],
    actorId: string,
  ) {
    const groups = new Map<string, CardStockSettlement[]>();
    for (const row of rows) {
      const key = `${row.transactionId}:${row.issuerPartyProfileId}:${row.currencyId}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    const itemRepo = manager.getRepository(CardStockSettlement);
    for (const group of groups.values()) {
      const first = group[0];
      const ho = await this.getBranch(first.hoBranchId);
      const selling = await this.getBranch(first.branchId);
      const date = this.toTimestamp(
        first.branchRequestedDate ?? first.saleDate,
        "CARD settlement date is invalid",
      );
      const document = await this.createDocument(manager, {
        kind: CardStockSettlementDocumentKind.BRANCH_HO,
        status: CardStockSettlementDocumentStatus.PENDING_HO_ACCEPTANCE,
        transactionDate: date,
        numberBranch: selling,
        issuerPartyProfileId: first.issuerPartyProfileId,
        issuerPartyProfileSnapshot: first.issuerPartyProfileSnapshot,
        currencyId: first.currencyId,
        currencySnapshot: first.currencySnapshot,
        branchId: first.branchId,
        branchSnapshot: first.branchSnapshot,
        hoBranchId: first.hoBranchId,
        hoBranchSnapshot: first.hoBranchSnapshot,
        reference: null,
        remarks: null,
        actorId,
      });
      for (const row of group)
        await itemRepo.update(row.id, {
          branchDocumentId: document.id,
          updatedBy: actorId,
        });
      if (selling.id === ho.id)
        await this.postBranchDocument(manager, document.id, actorId, false);
    }
  }

  private async postBranchDocument(
    manager: EntityManager,
    documentId: string,
    actorId: string,
    acceptedByHo: boolean,
  ) {
    const documentRepo = manager.getRepository(CardStockSettlementDocument);
    const itemRepo = manager.getRepository(CardStockSettlement);
    const document = await documentRepo.findOne({ where: { id: documentId } });
    if (!document) throw new NotFoundException("CARD settlement not found");
    const itemIds: Array<{ id: string }> = await manager.query(
      `SELECT id FROM card_stock_settlements WHERE deleted_at IS NULL AND branch_document_id = $1`,
      [document.id],
    );
    const items = await this.lockSettlementRows(
      manager,
      itemIds.map((row) => row.id),
    );
    if (!items.length)
      throw new BadRequestException("CARD settlement has no items");
    const branch = await this.getBranch(document.branchId);
    await this.dayEndStartProcessService.assertTransactionDateAllowed(
      branch.id,
      actorId,
      document.transactionDate,
    );
    const posting = await this.cardStockTransactionService.create({
      manager,
      operationCode: TransactionTypeProfileEnum.CARD_SETTLE,
      number: document.transactionNumber,
      branch,
      transactionDate: document.transactionDate,
      actorId,
      items: [...items]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((row) => ({
          cardId: row.cardId,
          currencyId: row.currencyId,
          productId: row.productId,
          quantity: row.denomination,
          per: "1",
          rate: row.buyRate,
          referenceType: CardStockReferenceType.CARD_BRANCH_SETTLEMENT,
          referenceId: row.id,
        })),
    });
    const postedItems = await itemRepo.find({
      where: { branchDocumentId: document.id },
    });
    if (postedItems.some((row) => !row.branchSettlementEntryId)) {
      throw new BadRequestException(
        "Branch settlement ledger entry was not created for one or more cards",
      );
    }
    const postedIds = postedItems.map((row) => row.id);
    await itemRepo.update(
      { id: In(postedIds) },
      acceptedByHo
        ? {
            status: CardStockSettlementStatus.PENDING_ISSUER_SETTLEMENT,
            hoAcceptedAt: new Date(),
            hoAcceptedById: actorId,
            updatedBy: actorId,
          }
        : {
            status: CardStockSettlementStatus.PENDING_ISSUER_SETTLEMENT,
            updatedBy: actorId,
          },
    );
    await documentRepo.update(document.id, {
      status: CardStockSettlementDocumentStatus.ACCEPTED,
      postingTransactionId: posting.id,
      acceptedAt: new Date(),
      acceptedById: actorId,
      updatedBy: actorId,
    });
  }

  private async postIssuerDocument(
    manager: EntityManager,
    documentId: string,
    actorId: string,
  ) {
    const documentRepo = manager.getRepository(CardStockSettlementDocument);
    const itemRepo = manager.getRepository(CardStockSettlement);
    const document = await documentRepo.findOne({ where: { id: documentId } });
    if (!document) throw new NotFoundException("CARD settlement not found");
    const itemIds: Array<{ id: string }> = await manager.query(
      `SELECT id FROM card_stock_settlements WHERE deleted_at IS NULL AND issuer_document_id = $1`,
      [document.id],
    );
    const items = await this.lockSettlementRows(
      manager,
      itemIds.map((row) => row.id),
    );
    if (!items.length)
      throw new BadRequestException("CARD settlement has no items");
    const ho = await this.getBranch(document.hoBranchId);
    await this.dayEndStartProcessService.assertTransactionDateAllowed(
      ho.id,
      actorId,
      document.transactionDate,
    );
    const posting = await this.cardStockTransactionService.create({
      manager,
      operationCode: TransactionTypeProfileEnum.CARD_SETTLE,
      number: document.transactionNumber,
      branch: ho,
      transactionDate: document.transactionDate,
      actorId,
      items: [...items]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((row) => ({
          cardId: row.cardId,
          currencyId: row.currencyId,
          productId: row.productId,
          quantity: row.denomination,
          per: "1",
          rate: row.issuerRate ?? row.buyRate,
          referenceType: CardStockReferenceType.CARD_ISSUER_SETTLEMENT,
          referenceId: row.id,
        })),
    });
    const postedItems = await itemRepo.find({
      where: { issuerDocumentId: document.id },
    });
    if (postedItems.some((row) => !row.issuerSettlementEntryId)) {
      throw new BadRequestException(
        "Issuer settlement ledger entry was not created for one or more cards",
      );
    }
    await itemRepo.update(
      { id: In(postedItems.map((row) => row.id)) },
      {
        status: CardStockSettlementStatus.ISSUER_SETTLED,
        issuerSettlementDate: document.transactionDate,
        issuerReference: document.reference,
        issuerRemarks: document.remarks,
        updatedBy: actorId,
      },
    );
    await documentRepo.update(document.id, {
      status: CardStockSettlementDocumentStatus.ISSUER_SETTLED,
      postingTransactionId: posting.id,
      updatedBy: actorId,
    });
  }

  async create(
    dto: CreateCardStockSettlementDocumentDto,
    session: AuthenticatedSession,
  ) {
    if (!session?.userId)
      throw new ForbiddenException("User session is required");
    const isHo = this.isHo(session);
    if (dto.kind === CardStockSettlementDocumentKind.HO_ISSUER && !isHo)
      throw new ForbiddenException(
        "Only Admin/HO users can settle with issuers",
      );
    if (dto.kind === CardStockSettlementDocumentKind.BRANCH_HO && isHo)
      throw new ForbiddenException("HO creates issuer settlements only");
    const id = await this.database2.transaction(async (manager) => {
      const itemRepo = manager.getRepository(CardStockSettlement);
      const uniqueIds = [...new Set(dto.items.map((item) => item.id))];
      if (uniqueIds.length !== dto.items.length)
        throw new BadRequestException(
          "Duplicate CARD items cannot be settled together",
        );
      const rows = await this.lockSettlementRows(manager, uniqueIds);
      if (rows.length !== uniqueIds.length)
        throw new BadRequestException("One or more CARD items were not found");
      const rates = new Map(
        dto.items.map((item) => [
          item.id,
          this.parseRate(
            item.rate,
            "Settlement rate must be greater than zero",
          ),
        ]),
      );
      const first = rows[0];
      if (
        rows.some(
          (row) =>
            row.issuerPartyProfileId !== dto.issuerPartyProfileId ||
            row.currencyId !== dto.currencyId,
        )
      ) {
        throw new BadRequestException(
          "Selected CARD items must match the issuer and currency",
        );
      }
      const date = this.toTimestamp(
        dto.transactionDate,
        "Settlement date is invalid",
      );
      if (rows.some((row) => this.isCalendarBefore(date, row.saleDate)))
        throw new BadRequestException(
          "Settlement date cannot be before the CARD sale date",
        );
      const reference = this.clean(dto.reference);
      const remarks = this.clean(dto.remarks);
      if (dto.kind === CardStockSettlementDocumentKind.BRANCH_HO) {
        const branchId = session.activeBranchId;
        if (!branchId)
          throw new BadRequestException("Current branch is required");
        if (
          rows.some(
            (row) =>
              row.branchId !== branchId ||
              row.status !==
                CardStockSettlementStatus.PENDING_BRANCH_SETTLEMENT ||
              row.settlementMode !== CardStockSettlementMode.MANUAL ||
              row.branchDocumentId,
          )
        ) {
          throw new BadRequestException(
            "Only unsettled MANUAL CARD items for the current branch can be submitted",
          );
        }
        const document = await this.createDocument(manager, {
          kind: CardStockSettlementDocumentKind.BRANCH_HO,
          status: CardStockSettlementDocumentStatus.PENDING_HO_ACCEPTANCE,
          transactionDate: date,
          numberBranch: await this.getBranch(first.branchId),
          issuerPartyProfileId: first.issuerPartyProfileId,
          issuerPartyProfileSnapshot: first.issuerPartyProfileSnapshot,
          currencyId: first.currencyId,
          currencySnapshot: first.currencySnapshot,
          branchId: first.branchId,
          branchSnapshot: first.branchSnapshot,
          hoBranchId: first.hoBranchId,
          hoBranchSnapshot: first.hoBranchSnapshot,
          reference,
          remarks,
          actorId: session.userId,
        });
        for (const row of rows) {
          const rate = rates.get(row.id) ?? 0;
          await itemRepo.update(row.id, {
            buyRate: rate.toFixed(7),
            settlementAmount: this.amountFrom(row.denomination, rate),
            branchRequestedDate: date,
            branchReference: reference,
            branchRemarks: remarks,
            branchRequestedAt: new Date(),
            branchRequestedById: session.userId,
            status: CardStockSettlementStatus.PENDING_HO_ACCEPTANCE,
            hoRejectedAt: null,
            hoRejectedById: null,
            hoRejectionReason: null,
            branchDocumentId: document.id,
            updatedBy: session.userId,
          });
        }
        return document.id;
      }
      if (
        rows.some(
          (row) =>
            row.status !==
              CardStockSettlementStatus.PENDING_ISSUER_SETTLEMENT ||
            !row.branchSettlementEntryId ||
            row.issuerDocumentId,
        )
      ) {
        throw new BadRequestException(
          "Only branch-settled CARD items can be settled with issuers",
        );
      }
      if (!dto.hoBranchId)
        throw new BadRequestException("HO branch is required");
      const ho = await this.getBranch(dto.hoBranchId);
      if (!ho.isHeadOffice)
        throw new BadRequestException(
          "Issuer settlement must use an HO branch",
        );
      if (rows.some((row) => row.hoBranchId !== ho.id)) {
        throw new BadRequestException(
          "Selected CARD items must belong to the selected HO branch",
        );
      }
      if (
        rows.some((row) =>
          this.isCalendarBefore(date, row.branchSettlementDate ?? row.saleDate),
        )
      ) {
        throw new BadRequestException(
          "Issuer settlement date cannot be before the branch settlement date",
        );
      }
      const document = await this.createDocument(manager, {
        kind: CardStockSettlementDocumentKind.HO_ISSUER,
        status: CardStockSettlementDocumentStatus.ISSUER_SETTLED,
        transactionDate: date,
        numberBranch: ho,
        issuerPartyProfileId: first.issuerPartyProfileId,
        issuerPartyProfileSnapshot: first.issuerPartyProfileSnapshot,
        currencyId: first.currencyId,
        currencySnapshot: first.currencySnapshot,
        branchId: ho.id,
        branchSnapshot: {
          id: ho.id,
          code: ho.code,
          name: ho.name,
          label: `${ho.code} - ${ho.name}`,
        },
        hoBranchId: ho.id,
        hoBranchSnapshot: {
          id: ho.id,
          code: ho.code,
          name: ho.name,
          label: `${ho.code} - ${ho.name}`,
        },
        reference,
        remarks,
        actorId: session.userId,
      });
      for (const row of rows) {
        const rate = rates.get(row.id) ?? 0;
        await itemRepo.update(row.id, {
          issuerRate: rate.toFixed(7),
          issuerSettlementAmount: this.amountFrom(row.denomination, rate),
          issuerDocumentId: document.id,
          updatedBy: session.userId,
        });
      }
      await this.postIssuerDocument(manager, document.id, session.userId);
      return document.id;
    });
    return this.get(id, session);
  }

  async listUnsettled(
    query: CardStockUnsettledQueryDto,
    session: AuthenticatedSession,
  ) {
    const pagination = normalizePagination(query);
    if (!session?.userId)
      throw new ForbiddenException("User session is required");
    const conditions = [
      "s.deleted_at IS NULL",
      "s.issuer_party_profile_id = $1",
      "s.currency_id = $2",
    ];
    const params: unknown[] = [query.issuerPartyProfileId, query.currencyId];
    if (query.kind === CardStockSettlementDocumentKind.BRANCH_HO) {
      if (this.isHo(session))
        throw new ForbiddenException("HO creates issuer settlements only");
      if (!session.activeBranchId)
        return buildPaginatedResponse([], 0, pagination);
      params.push(session.activeBranchId);
      conditions.push(
        `s.branch_id = $${params.length}`,
        `s.status = 'PENDING_BRANCH_SETTLEMENT'`,
        `s.settlement_mode = 'MANUAL'`,
        "s.branch_document_id IS NULL",
      );
    } else {
      if (!this.isHo(session))
        throw new ForbiddenException(
          "Only Admin/HO users can settle with issuers",
        );
      if (!query.hoBranchId)
        throw new BadRequestException("HO branch is required");
      params.push(query.hoBranchId);
      conditions.push(
        `s.status = 'PENDING_ISSUER_SETTLEMENT'`,
        "s.issuer_document_id IS NULL",
        "s.branch_settlement_entry_id IS NOT NULL",
        `s.ho_branch_id = $${params.length}`,
      );
    }
    const whereSql = conditions.join(" AND ");
    const countRows = await this.database2.query(
      `SELECT COUNT(*)::int AS total
       FROM card_stock_settlements s JOIN card_stock_cards c ON c.id=s.card_id
       WHERE ${whereSql}`,
      params,
    );
    const total = Number(countRows[0]?.total ?? 0);
    params.push(pagination.limit, pagination.offset);
    const data = await this.database2.query(
      `SELECT s.id, s.series, s.denomination, s.sale_kind AS "saleKind", s.sale_buy_rate AS "saleBuyRate", s.buy_rate AS "buyRate", s.settlement_amount AS "settlementAmount",
        s.branch_id AS "branchId", s.branch_snapshot AS "branchSnapshot", s.issuer_party_profile_id AS "issuerPartyProfileId", s.issuer_party_profile_snapshot AS "issuerPartyProfileSnapshot",
        s.currency_id AS "currencyId", s.currency_snapshot AS "currencySnapshot", s.product_id AS "productId", s.product_snapshot AS "productSnapshot",
        c.kit_number AS "kitNumber", ${MASKED_CARD_SQL} AS "maskedCardNumber"
       FROM card_stock_settlements s JOIN card_stock_cards c ON c.id=s.card_id
       CROSS JOIN LATERAL(SELECT public.decrypt_card_number(c.card_number) clear_number) decoded
       WHERE ${whereSql} ORDER BY s.sale_date DESC, s.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return buildPaginatedResponse(data, total, pagination);
  }

  private documentSelectSql() {
    return `SELECT d.id, d.transaction_number AS "transactionNumber", d.transaction_date AS "transactionDate", d.kind, d.status,
        d.issuer_party_profile_id AS "issuerPartyProfileId", d.issuer_party_profile_snapshot AS "issuerPartyProfileSnapshot",
        d.currency_id AS "currencyId", d.currency_snapshot AS "currencySnapshot",
        d.branch_id AS "branchId", d.branch_snapshot AS "branchSnapshot",
        d.ho_branch_id AS "hoBranchId", d.ho_branch_snapshot AS "hoBranchSnapshot",
        d.reference, d.remarks, d.rejection_reason AS "rejectionReason", d.cancellation_reason AS "cancellationReason",
        d.posting_transaction_id AS "postingTransactionId",
        (SELECT COUNT(*)::int FROM card_stock_settlements item WHERE item.deleted_at IS NULL AND ((d.kind='BRANCH_HO' AND item.branch_document_id=d.id) OR (d.kind='HO_ISSUER' AND item.issuer_document_id=d.id))) AS "itemCount"
       FROM card_stock_settlement_documents d`;
  }

  private documentListWhere(
    query: CardStockSettlementDocumentQueryDto,
    session: AuthenticatedSession,
  ): { conditions: string[]; params: unknown[] } | { empty: true } {
    if (!session?.userId) return { empty: true };
    const conditions = ["d.deleted_at IS NULL"];
    const params: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      params.push(value);
      conditions.push(sql.replace("?", `$${params.length}`));
    };
    if (!this.isHo(session)) {
      if (!session.activeBranchId) return { empty: true };
      add("d.branch_id = ?", session.activeBranchId);
      add("d.kind = ?", CardStockSettlementDocumentKind.BRANCH_HO);
    }
    if (query.status) add("d.status = ?", query.status);
    if (query.kind && this.isHo(session)) add("d.kind = ?", query.kind);
    if (query.issuerPartyProfileId)
      add("d.issuer_party_profile_id = ?", query.issuerPartyProfileId);
    if (query.currencyId) add("d.currency_id = ?", query.currencyId);
    if (query.branchId && this.isHo(session))
      add("d.branch_id = ?", query.branchId);
    if (query.dateFrom)
      add(
        "d.transaction_date >= ?",
        this.toTimestamp(query.dateFrom, "Date from is invalid"),
      );
    if (query.dateTo)
      add(
        "d.transaction_date < ?",
        toUtcNextDate(query.dateTo) ??
          this.toTimestamp(query.dateTo, "Date to is invalid"),
      );
    return { conditions, params };
  }

  async list(
    query: CardStockSettlementDocumentQueryDto,
    session: AuthenticatedSession,
  ) {
    const pagination = normalizePagination(query);
    const where = this.documentListWhere(query, session);
    if ("empty" in where) return buildPaginatedResponse([], 0, pagination);
    const countRows = await this.database2.query(
      `SELECT COUNT(*)::int AS total FROM card_stock_settlement_documents d WHERE ${where.conditions.join(" AND ")}`,
      where.params,
    );
    const total = Number(countRows[0]?.total ?? 0);
    const data = await this.database2.query(
      `${this.documentSelectSql()} WHERE ${where.conditions.join(" AND ")} ORDER BY d.transaction_date DESC, d.created_at DESC LIMIT $${where.params.length + 1} OFFSET $${where.params.length + 2}`,
      [...where.params, pagination.limit, pagination.offset],
    );
    return buildPaginatedResponse(data, total, pagination);
  }

  async get(id: string, session: AuthenticatedSession) {
    const where = this.documentListWhere({}, session);
    if ("empty" in where)
      throw new NotFoundException("CARD settlement not found");
    where.params.push(id);
    where.conditions.push(`d.id = $${where.params.length}`);
    const documents = await this.database2.query(
      `${this.documentSelectSql()} WHERE ${where.conditions.join(" AND ")}`,
      where.params,
    );
    const document = documents[0];
    if (!document) throw new NotFoundException("CARD settlement not found");
    const items = await this.database2.query(
      `SELECT s.id, s.series, s.denomination, s.sale_kind AS "saleKind", s.sale_buy_rate AS "saleBuyRate", s.buy_rate AS "buyRate", s.settlement_amount AS "settlementAmount",
        s.issuer_rate AS "issuerRate", s.issuer_settlement_amount AS "issuerSettlementAmount", s.status,
        s.branch_id AS "branchId", s.branch_snapshot AS "branchSnapshot", s.product_id AS "productId", s.product_snapshot AS "productSnapshot",
        c.kit_number AS "kitNumber", ${MASKED_CARD_SQL} AS "maskedCardNumber"
       FROM card_stock_settlements s JOIN card_stock_cards c ON c.id=s.card_id
       CROSS JOIN LATERAL(SELECT public.decrypt_card_number(c.card_number) clear_number) decoded
       WHERE s.deleted_at IS NULL AND ((s.branch_document_id=$1 AND $2='BRANCH_HO') OR (s.issuer_document_id=$1 AND $2='HO_ISSUER'))
       ORDER BY s.created_at`,
      [id, document.kind],
    );
    return { ...document, items };
  }

  async accept(id: string, session: AuthenticatedSession) {
    this.assertHo(session);
    const documentId = await this.database2.transaction(async (manager) => {
      const documentRepo = manager.getRepository(CardStockSettlementDocument);
      const document = await documentRepo
        .createQueryBuilder("d")
        .where("d.id = :id", { id })
        .setLock("pessimistic_write")
        .getOne();
      if (!document) throw new NotFoundException("CARD settlement not found");
      if (
        document.kind !== CardStockSettlementDocumentKind.BRANCH_HO ||
        document.status !==
          CardStockSettlementDocumentStatus.PENDING_HO_ACCEPTANCE ||
        document.postingTransactionId
      ) {
        throw new BadRequestException(
          "Only pending HO acceptance settlements can be accepted",
        );
      }
      await this.postBranchDocument(manager, document.id, session.userId, true);
      return document.id;
    });
    return this.get(id, session);
  }

  async reject(
    id: string,
    dto: RejectCardStockSettlementDocumentDto,
    session: AuthenticatedSession,
  ) {
    this.assertHo(session);
    await this.database2.transaction(async (manager) => {
      const documentRepo = manager.getRepository(CardStockSettlementDocument);
      const itemRepo = manager.getRepository(CardStockSettlement);
      const document = await documentRepo
        .createQueryBuilder("d")
        .where("d.id = :id", { id })
        .setLock("pessimistic_write")
        .getOne();
      if (!document) throw new NotFoundException("CARD settlement not found");
      if (
        document.kind !== CardStockSettlementDocumentKind.BRANCH_HO ||
        document.status !==
          CardStockSettlementDocumentStatus.PENDING_HO_ACCEPTANCE ||
        document.postingTransactionId
      ) {
        throw new BadRequestException(
          "Only pending HO acceptance settlements can be rejected",
        );
      }
      const itemIds: Array<{ id: string }> = await manager.query(
        `SELECT id FROM card_stock_settlements WHERE deleted_at IS NULL AND branch_document_id = $1`,
        [document.id],
      );
      const items = await this.lockSettlementRows(
        manager,
        itemIds.map((row) => row.id),
      );
      for (const row of items) {
        await itemRepo.update(row.id, {
          branchDocumentId: null,
          buyRate: row.saleBuyRate,
          settlementAmount: this.amountFrom(
            row.denomination,
            Number(row.saleBuyRate),
          ),
          branchRequestedDate: null,
          branchReference: null,
          branchRemarks: null,
          branchRequestedAt: null,
          branchRequestedById: null,
          settlementMode: CardStockSettlementMode.MANUAL,
          status: CardStockSettlementStatus.PENDING_BRANCH_SETTLEMENT,
          hoRejectedAt: new Date(),
          hoRejectedById: session.userId,
          hoRejectionReason: dto.reason.trim(),
          updatedBy: session.userId,
        });
      }
      await documentRepo.update(document.id, {
        status: CardStockSettlementDocumentStatus.REJECTED,
        rejectionReason: dto.reason.trim(),
        rejectedAt: new Date(),
        rejectedById: session.userId,
        updatedBy: session.userId,
      });
      return document.id;
    });
    return this.get(id, session);
  }

  async cancel(
    id: string,
    dto: CancelCardStockSettlementDocumentDto,
    session: AuthenticatedSession,
  ) {
    if (!session?.userId)
      throw new ForbiddenException("User session is required");
    await this.database2.transaction(async (manager) => {
      const documentRepo = manager.getRepository(CardStockSettlementDocument);
      const itemRepo = manager.getRepository(CardStockSettlement);
      const document = await documentRepo
        .createQueryBuilder("d")
        .where("d.id = :id", { id })
        .setLock("pessimistic_write")
        .getOne();
      if (!document) throw new NotFoundException("CARD settlement not found");
      if (
        document.postingTransactionId ||
        document.status !==
          CardStockSettlementDocumentStatus.PENDING_HO_ACCEPTANCE ||
        document.kind !== CardStockSettlementDocumentKind.BRANCH_HO
      ) {
        throw new BadRequestException(
          "Only unposted branch settlements can be cancelled",
        );
      }
      if (!this.isHo(session) && document.branchId !== session.activeBranchId)
        throw new ForbiddenException(
          "Settlement must belong to the current branch",
        );
      const itemIds: Array<{ id: string }> = await manager.query(
        `SELECT id FROM card_stock_settlements WHERE deleted_at IS NULL AND branch_document_id = $1`,
        [document.id],
      );
      const items = await this.lockSettlementRows(
        manager,
        itemIds.map((row) => row.id),
      );
      for (const row of items) {
        await itemRepo.update(row.id, {
          branchDocumentId: null,
          buyRate: row.saleBuyRate,
          settlementAmount: this.amountFrom(
            row.denomination,
            Number(row.saleBuyRate),
          ),
          branchRequestedDate: null,
          branchReference: null,
          branchRemarks: null,
          branchRequestedAt: null,
          branchRequestedById: null,
          settlementMode: CardStockSettlementMode.MANUAL,
          status: CardStockSettlementStatus.PENDING_BRANCH_SETTLEMENT,
          updatedBy: session.userId,
        });
      }
      await documentRepo.update(document.id, {
        status: CardStockSettlementDocumentStatus.CANCELLED,
        cancellationReason: dto.reason.trim(),
        cancelledAt: new Date(),
        cancelledById: session.userId,
        updatedBy: session.userId,
      });
    });
    return this.get(id, session);
  }

  async reconcile() {
    /* Approval and explicit settlement actions are atomic; pending manual/acceptance rows must remain untouched. */
  }
}
