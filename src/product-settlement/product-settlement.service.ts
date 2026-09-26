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
import { CardStockReferenceType } from "../card-stock/card-stock.enums";
import {
  ProductSettlementDocumentKind,
  ProductSettlementDocumentStatus,
  ProductSettlementMode,
  ProductSettlementSaleKind,
  ProductSettlementStatus,
  ProductSettlementType,
} from "./product-settlement.enums";
import { CardStockTransactionService } from "../card-stock/card-stock-transaction.service";
import {
  CancelProductSettlementDocumentDto,
  ProductSettlementDocumentQueryDto,
  ProductUnsettledQueryDto,
  CreateProductSettlementDocumentDto,
  RejectProductSettlementDocumentDto,
} from "./dto/product-settlement.dto";
import { CardStockCard } from "../card-stock/entities/card-stock-card.entity";
import { ProductSettlement } from "./entities/product-settlement.entity";
import { ProductSettlementDocument } from "./entities/product-settlement-document.entity";
import { DealCover } from "../tt-deal/entities/deal-cover.entity";
import { TransactionReferenceSnapshotValue } from "../transactions/types/transaction-snapshot.types";
import {
  buildPaginatedResponse,
  normalizePagination,
} from "../common/pagination";

const MASKED_CARD_SQL = `CASE WHEN decoded.clear_number IS NULL THEN NULL WHEN length(decoded.clear_number)<=8 THEN left(decoded.clear_number,4)||repeat('X',greatest(length(decoded.clear_number)-4,0)) ELSE left(decoded.clear_number,4)||repeat('X',length(decoded.clear_number)-8)||right(decoded.clear_number,4) END`;

@Injectable()
export class ProductSettlementService {
  private readonly logger = new Logger(ProductSettlementService.name);
  constructor(
    @InjectDataSource("database2") private readonly database2: DataSource,
    @InjectRepository(ProductSettlement, "database2")
    private readonly settlementRepository: Repository<ProductSettlement>,
    @InjectRepository(ProductSettlementDocument, "database2")
    private readonly documentRepository: Repository<ProductSettlementDocument>,
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

  private resolveProductCode(
    productSnapshot: TransactionReferenceSnapshotValue | null | undefined,
    fallback?: string | null,
  ): string {
    const snapshot =
      productSnapshot && typeof productSnapshot === "object"
        ? (productSnapshot as Record<string, unknown>)
        : null;
    const raw =
      snapshot?.productCode ??
      snapshot?.code ??
      snapshot?.product_code ??
      fallback ??
      "";
    const code = String(raw).trim().toUpperCase();
    if (!code) {
      throw new BadRequestException(
        "Settlement requires a product code on the product snapshot",
      );
    }
    return code;
  }

  private settleOperationCode(productCode: string) {
    const code = productCode.trim().toUpperCase();
    if (code === "CM") return TransactionTypeProfileEnum.CM_SETTLE;
    if (code === "TT") return TransactionTypeProfileEnum.TT_SETTLE;
    return TransactionTypeProfileEnum.CARD_SETTLE;
  }

  private buildTtSeriesRef(
    branchCode: string,
    transactionDate: Date,
    transactionNumber: string,
    lineNo: number,
  ): string {
    const branch = String(branchCode ?? "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .padEnd(4, "0")
      .slice(0, 4);
    const year = String(transactionDate.getUTCFullYear()).slice(-2);
    const txn = String(transactionNumber ?? "")
      .replace(/\D/g, "")
      .slice(-8)
      .padStart(8, "0");
    const series = String(Math.max(1, Number(lineNo) || 1))
      .replace(/\D/g, "")
      .slice(-2)
      .padStart(2, "0");
    return `${branch}${year}${txn}${series}`;
  }

  private async reserveNumber(
    branch: Branch,
    date: Date,
    productCode: string,
  ) {
    return this.additionalSettingService.reserveTransactionNumber(
      this.settleOperationCode(productCode),
      branch.code,
      date,
    );
  }

  private assertSameProductCode(rows: ProductSettlement[]) {
    if (!rows.length) return;
    if (rows.some((row) => row.productCode !== rows[0].productCode)) {
      throw new BadRequestException(
        "Settlement document cannot mix different product codes",
      );
    }
  }

  private sortIds(ids: string[]) {
    return [...new Set(ids.filter(Boolean))].sort((left, right) =>
      left.localeCompare(right),
    );
  }

  private async lockRowsById(
    manager: EntityManager,
    table: "transactions" | "transaction_items" | "product_settlements",
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
      `SELECT id, transaction_id, transaction_item_id FROM product_settlements WHERE id = ANY($1::uuid[])`,
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
      "product_settlements",
      preview.map((row) => row.id),
    );
    const rows = await manager
      .getRepository(ProductSettlement)
      .find({ where: { id: In(uniqueIds) } });
    return rows.sort((left, right) => left.id.localeCompare(right.id));
  }

  private async createDocument(
    manager: EntityManager,
    input: {
      kind: ProductSettlementDocumentKind;
      status: ProductSettlementDocumentStatus;
      transactionDate: Date;
      numberBranch: Branch;
      productCode: string;
      issuerPartyProfileId: string;
      issuerPartyProfileSnapshot: ProductSettlement["issuerPartyProfileSnapshot"];
      currencyId: string;
      currencySnapshot: ProductSettlement["currencySnapshot"];
      branchId: string;
      branchSnapshot: ProductSettlement["branchSnapshot"];
      hoBranchId: string;
      hoBranchSnapshot: ProductSettlement["hoBranchSnapshot"];
      reference: string | null;
      remarks: string | null;
      actorId: string;
    },
  ) {
    const repo = manager.getRepository(ProductSettlementDocument);
    return repo.save(
      repo.create({
        transactionNumber: await this.reserveNumber(
          input.numberBranch,
          input.transactionDate,
          input.productCode,
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
    const repo = manager.getRepository(ProductSettlement);
    const cardRepo = manager.getRepository(CardStockCard);
    const saleRows: ProductSettlement[] = [];
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
          ? ProductSettlementMode.AUTO
          : ProductSettlementMode.MANUAL;
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
        const productCode = this.resolveProductCode(item.productSnapshot);
        row = await repo.save(
          repo.create({
            type: ProductSettlementType.CARD,
            productCode,
            cardId: card.id,
            dealCoverId: null,
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
            bookingRate: null,
            buyRateSnapshot: quote.snapshot,
            settlementAmount: (denomination * quote.buyRate).toFixed(2),
            saleDate,
            settlementMode: mode,
            saleKind: item.isReload
              ? ProductSettlementSaleKind.RELOAD
              : ProductSettlementSaleKind.FRESH,
            branchRequestedDate: freezeBranch ? saleDate : null,
            branchReference: null,
            branchRemarks: null,
            branchRequestedAt: freezeBranch ? new Date() : null,
            branchRequestedById: freezeBranch ? actorId : null,
            status:
              freezeBranch && sellingBranch.id !== ho.id
                ? ProductSettlementStatus.PENDING_HO_ACCEPTANCE
                : ProductSettlementStatus.PENDING_BRANCH_SETTLEMENT,
            createdBy: actorId,
            updatedBy: actorId,
          }),
        );
      }
      saleRows.push(row);
    }
    const frozenRows = saleRows.filter(
      (row) =>
        row.settlementMode === ProductSettlementMode.AUTO &&
        !row.branchDocumentId,
    );
    if (frozenRows.length)
      await this.createFrozenBranchDocuments(manager, frozenRows, actorId);
  }

  async createForApprovedTtItems(
    manager: EntityManager,
    transaction: Transaction,
    items: TransactionItem[],
    actorId: string,
  ) {
    if (transaction.status !== TransactionStatus.APPROVED) {
      throw new BadRequestException(
        "TT settlement requires an approved transaction",
      );
    }
    const sellingBranch = await this.getBranch(transaction.branchId);
    const auto = await this.additionalSettingService.getSettingBooleanValue(
      "TT_SETTINGS",
      "AUTO_SETTLE_TT_WITH_HO",
      true,
    );
    const repo = manager.getRepository(ProductSettlement);
    const dealRepo = manager.getRepository(DealCover);
    const saleRows: ProductSettlement[] = [];
    for (const item of items) {
      const dealCoverId = item.dealCoverId;
      if (!dealCoverId) continue;
      let row = await repo.findOne({
        where: { dealCoverId, transactionItemId: item.id },
      });
      if (!row) {
        const deal = await dealRepo.findOne({ where: { id: dealCoverId } });
        if (!deal || !item.issuerPartyProfileId) {
          throw new BadRequestException(
            `TT settlement source is incomplete for item ${item.lineNo}`,
          );
        }
        if (
          !deal.consumedTransactionItemId ||
          deal.consumedTransactionItemId !== item.id
        ) {
          throw new BadRequestException(
            `TT deal for item ${item.lineNo} must be consumed before settlement`,
          );
        }
        if (!deal.dealNo?.trim()) {
          throw new BadRequestException(
            `TT deal for item ${item.lineNo} is missing deal number`,
          );
        }
        const dealRate = Number(deal.dealRate);
        if (!Number.isFinite(dealRate) || dealRate <= 0) {
          throw new BadRequestException(
            `TT deal rate is invalid for item ${item.lineNo}`,
          );
        }
        const ho = await this.getSettlementHo(sellingBranch.id, sellingBranch);
        const freezeBranch = auto || sellingBranch.id === ho.id;
        const mode = freezeBranch
          ? ProductSettlementMode.AUTO
          : ProductSettlementMode.MANUAL;
        const denomination = Number(item.quantity ?? deal.feAmount);
        const saleBuyRate = dealRate.toFixed(7);
        const saleDate = this.toTimestamp(
          transaction.transactionDate,
          `TT item ${item.lineNo} is missing a sale date`,
        );
        const settlementAmount = (denomination * dealRate).toFixed(2);
        const productCode = this.resolveProductCode(item.productSnapshot, "TT");
        const series = this.buildTtSeriesRef(
          sellingBranch.code,
          saleDate,
          transaction.number,
          item.lineNo,
        );
        row = await repo.save(
          repo.create({
            type: ProductSettlementType.TT,
            productCode,
            cardId: null,
            dealCoverId: deal.id,
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
              deal.issuerPartyProfileSnapshot,
            currencyId: item.currencyId,
            currencySnapshot: item.currencySnapshot,
            productId: item.productId,
            productSnapshot: item.productSnapshot,
            passengerId: transaction.passengerId,
            passengerSnapshot: transaction.passengerSnapshot,
            series,
            denomination: denomination.toFixed(2),
            saleBuyRate,
            buyRate: saleBuyRate,
            bookingRate: deal.bookingRate,
            buyRateSnapshot: {
              source: "TT_DEAL_RATE",
              dealRate: deal.dealRate,
              bookingRate: deal.bookingRate,
              dealRateSnapshot: deal.dealRateSnapshot,
            },
            settlementAmount,
            saleDate,
            settlementMode: mode,
            saleKind: ProductSettlementSaleKind.FRESH,
            branchRequestedDate: freezeBranch ? saleDate : null,
            branchReference: null,
            branchRemarks: null,
            branchRequestedAt: freezeBranch ? new Date() : null,
            branchRequestedById: freezeBranch ? actorId : null,
            status:
              freezeBranch && sellingBranch.id !== ho.id
                ? ProductSettlementStatus.PENDING_HO_ACCEPTANCE
                : ProductSettlementStatus.PENDING_BRANCH_SETTLEMENT,
            createdBy: actorId,
            updatedBy: actorId,
          }),
        );
        const itemAmount = Number(item.amount);
        if (Number.isFinite(itemAmount)) {
          await manager.getRepository(TransactionItem).update(item.id, {
            profitAmount: (itemAmount - Number(settlementAmount)).toFixed(2),
            updatedBy: actorId,
          });
        }
      }
      saleRows.push(row);
    }
    const frozenRows = saleRows.filter(
      (row) =>
        row.settlementMode === ProductSettlementMode.AUTO &&
        !row.branchDocumentId,
    );
    if (frozenRows.length)
      await this.createFrozenBranchDocuments(manager, frozenRows, actorId);
  }

  private async createFrozenBranchDocuments(
    manager: EntityManager,
    rows: ProductSettlement[],
    actorId: string,
  ) {
    const groups = new Map<string, ProductSettlement[]>();
    for (const row of rows) {
      const key = `${row.productCode}:${row.type}:${row.transactionId}:${row.issuerPartyProfileId}:${row.currencyId}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    const itemRepo = manager.getRepository(ProductSettlement);
    for (const group of groups.values()) {
      this.assertSameProductCode(group);
      const first = group[0];
      const ho = await this.getBranch(first.hoBranchId);
      const selling = await this.getBranch(first.branchId);
      const date = this.toTimestamp(
        first.branchRequestedDate ?? first.saleDate,
        "CARD settlement date is invalid",
      );
      const document = await this.createDocument(manager, {
        kind: ProductSettlementDocumentKind.BRANCH_HO,
        status: ProductSettlementDocumentStatus.PENDING_HO_ACCEPTANCE,
        transactionDate: date,
        numberBranch: selling,
        productCode: first.productCode,
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
    const documentRepo = manager.getRepository(ProductSettlementDocument);
    const itemRepo = manager.getRepository(ProductSettlement);
    const document = await documentRepo.findOne({ where: { id: documentId } });
    if (!document) throw new NotFoundException("CARD settlement not found");
    const itemIds: Array<{ id: string }> = await manager.query(
      `SELECT id FROM product_settlements WHERE deleted_at IS NULL AND branch_document_id = $1`,
      [document.id],
    );
    const items = await this.lockSettlementRows(
      manager,
      itemIds.map((row) => row.id),
    );
    if (!items.length)
      throw new BadRequestException("CARD settlement has no items");
    this.assertSameProductCode(items);
    if (items.some((row) => row.type !== items[0].type)) {
      throw new BadRequestException(
        "Settlement document cannot mix CARD and TT items",
      );
    }
    const isTt = items[0].type === ProductSettlementType.TT;
    const branch = await this.getBranch(document.branchId);
    await this.dayEndStartProcessService.assertTransactionDateAllowed(
      branch.id,
      actorId,
      document.transactionDate,
    );
    const posting = await this.cardStockTransactionService.create({
      manager,
      operationCode: this.settleOperationCode(items[0].productCode),
      number: document.transactionNumber,
      branch,
      transactionDate: document.transactionDate,
      actorId,
      items: [...items]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((row) => ({
          cardId: row.cardId ?? undefined,
          currencyId: row.currencyId,
          productId: row.productId,
          quantity: row.denomination,
          per: "1",
          rate: row.buyRate,
          referenceType: CardStockReferenceType.CARD_BRANCH_SETTLEMENT,
          referenceId: row.id,
        })),
    });
    if (!isTt) {
      const postedItems = await itemRepo.find({
        where: { branchDocumentId: document.id },
      });
      if (postedItems.some((row) => !row.branchSettlementEntryId)) {
        throw new BadRequestException(
          "Branch settlement ledger entry was not created for one or more cards",
        );
      }
    } else {
      await itemRepo.update(
        { id: In(items.map((row) => row.id)) },
        {
          branchSettlementDate: document.transactionDate,
          updatedBy: actorId,
        },
      );
    }
    const postedItems = await itemRepo.find({
      where: { branchDocumentId: document.id },
    });
    const postedIds = postedItems.map((row) => row.id);
    await itemRepo.update(
      { id: In(postedIds) },
      acceptedByHo
        ? {
            status: ProductSettlementStatus.PENDING_ISSUER_SETTLEMENT,
            hoAcceptedAt: new Date(),
            hoAcceptedById: actorId,
            updatedBy: actorId,
          }
        : {
            status: ProductSettlementStatus.PENDING_ISSUER_SETTLEMENT,
            updatedBy: actorId,
          },
    );
    await documentRepo.update(document.id, {
      status: ProductSettlementDocumentStatus.ACCEPTED,
      postingTransactionId: posting.id,
      acceptedAt: new Date(),
      acceptedById: actorId,
      updatedBy: actorId,
    });
    // Re-fire hold/profit trigger so sale lines get profit_amount for product-profit.
    await this.refreshSaleItemProfit(
      manager,
      postedItems.map((row) => row.transactionItemId),
    );
  }

  private async refreshSaleItemProfit(
    manager: EntityManager,
    transactionItemIds: Array<string | null | undefined>,
  ) {
    const ids = [
      ...new Set(
        transactionItemIds.filter((id): id is string => Boolean(id?.trim())),
      ),
    ];
    if (!ids.length) return;
    await manager.query(
      `UPDATE transaction_items
          SET updated_at = CLOCK_TIMESTAMP()
        WHERE id = ANY($1::uuid[])`,
      [ids],
    );
  }

  private async postIssuerDocument(
    manager: EntityManager,
    documentId: string,
    actorId: string,
  ) {
    const documentRepo = manager.getRepository(ProductSettlementDocument);
    const itemRepo = manager.getRepository(ProductSettlement);
    const document = await documentRepo.findOne({ where: { id: documentId } });
    if (!document) throw new NotFoundException("CARD settlement not found");
    const itemIds: Array<{ id: string }> = await manager.query(
      `SELECT id FROM product_settlements WHERE deleted_at IS NULL AND issuer_document_id = $1`,
      [document.id],
    );
    const items = await this.lockSettlementRows(
      manager,
      itemIds.map((row) => row.id),
    );
    if (!items.length)
      throw new BadRequestException("CARD settlement has no items");
    this.assertSameProductCode(items);
    if (items.some((row) => row.type !== items[0].type)) {
      throw new BadRequestException(
        "Settlement document cannot mix CARD and TT items",
      );
    }
    const isTt = items[0].type === ProductSettlementType.TT;
    const ho = await this.getBranch(document.hoBranchId);
    await this.dayEndStartProcessService.assertTransactionDateAllowed(
      ho.id,
      actorId,
      document.transactionDate,
    );
    const posting = await this.cardStockTransactionService.create({
      manager,
      operationCode: this.settleOperationCode(items[0].productCode),
      number: document.transactionNumber,
      branch: ho,
      transactionDate: document.transactionDate,
      actorId,
      items: [...items]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((row) => ({
          cardId: row.cardId ?? undefined,
          currencyId: row.currencyId,
          productId: row.productId,
          quantity: row.denomination,
          per: "1",
          rate: row.issuerRate ?? row.buyRate,
          referenceType: CardStockReferenceType.CARD_ISSUER_SETTLEMENT,
          referenceId: row.id,
        })),
    });
    if (!isTt) {
      const postedItems = await itemRepo.find({
        where: { issuerDocumentId: document.id },
      });
      if (postedItems.some((row) => !row.issuerSettlementEntryId)) {
        throw new BadRequestException(
          "Issuer settlement ledger entry was not created for one or more cards",
        );
      }
    }
    await itemRepo.update(
      { id: In(items.map((row) => row.id)) },
      {
        status: ProductSettlementStatus.ISSUER_SETTLED,
        issuerSettlementDate: document.transactionDate,
        issuerReference: document.reference,
        issuerRemarks: document.remarks,
        updatedBy: actorId,
      },
    );
    await documentRepo.update(document.id, {
      status: ProductSettlementDocumentStatus.ISSUER_SETTLED,
      postingTransactionId: posting.id,
      updatedBy: actorId,
    });
  }

  async create(
    dto: CreateProductSettlementDocumentDto,
    session: AuthenticatedSession,
  ) {
    if (!session?.userId)
      throw new ForbiddenException("User session is required");
    const isHo = this.isHo(session);
    if (dto.kind === ProductSettlementDocumentKind.HO_ISSUER && !isHo)
      throw new ForbiddenException(
        "Only Admin/HO users can settle with issuers",
      );
    if (dto.kind === ProductSettlementDocumentKind.BRANCH_HO && isHo)
      throw new ForbiddenException("HO creates issuer settlements only");
    const id = await this.database2.transaction(async (manager) => {
      const itemRepo = manager.getRepository(ProductSettlement);
      const uniqueIds = [...new Set(dto.items.map((item) => item.id))];
      if (uniqueIds.length !== dto.items.length)
        throw new BadRequestException(
          "Duplicate CARD items cannot be settled together",
        );
      const rows = await this.lockSettlementRows(manager, uniqueIds);
      if (rows.length !== uniqueIds.length)
        throw new BadRequestException("One or more CARD items were not found");
      this.assertSameProductCode(rows);
      if (rows.some((row) => row.type !== rows[0].type)) {
        throw new BadRequestException(
          "Selected items cannot mix CARD and TT in one settlement document",
        );
      }
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
      if (dto.kind === ProductSettlementDocumentKind.BRANCH_HO) {
        const branchId = session.activeBranchId;
        if (!branchId)
          throw new BadRequestException("Current branch is required");
        if (
          rows.some(
            (row) =>
              row.branchId !== branchId ||
              row.status !==
                ProductSettlementStatus.PENDING_BRANCH_SETTLEMENT ||
              row.settlementMode !== ProductSettlementMode.MANUAL ||
              row.branchDocumentId,
          )
        ) {
          throw new BadRequestException(
            "Only unsettled MANUAL CARD items for the current branch can be submitted",
          );
        }
        const document = await this.createDocument(manager, {
          kind: ProductSettlementDocumentKind.BRANCH_HO,
          status: ProductSettlementDocumentStatus.PENDING_HO_ACCEPTANCE,
          transactionDate: date,
          numberBranch: await this.getBranch(first.branchId),
          productCode: first.productCode,
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
            status: ProductSettlementStatus.PENDING_HO_ACCEPTANCE,
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
              ProductSettlementStatus.PENDING_ISSUER_SETTLEMENT ||
            row.issuerDocumentId ||
            (row.type === ProductSettlementType.CARD &&
              !row.branchSettlementEntryId),
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
        kind: ProductSettlementDocumentKind.HO_ISSUER,
        status: ProductSettlementDocumentStatus.ISSUER_SETTLED,
        transactionDate: date,
        numberBranch: ho,
        productCode: first.productCode,
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
    query: ProductUnsettledQueryDto,
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
    if (query.kind === ProductSettlementDocumentKind.BRANCH_HO) {
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
        `(
          (s.type = 'CARD' AND s.branch_settlement_entry_id IS NOT NULL)
          OR (s.type = 'TT')
        )`,
        `s.ho_branch_id = $${params.length}`,
      );
    }
    const whereSql = conditions.join(" AND ");
    const countRows = await this.database2.query(
      `SELECT COUNT(*)::int AS total
       FROM product_settlements s
       WHERE ${whereSql}`,
      params,
    );
    const total = Number(countRows[0]?.total ?? 0);
    params.push(pagination.limit, pagination.offset);
    const data = await this.database2.query(
      `SELECT s.id, s.type, s.product_code AS "productCode", s.series, s.denomination, s.sale_kind AS "saleKind",
        s.sale_buy_rate AS "saleBuyRate", s.buy_rate AS "buyRate",
        s.booking_rate AS "bookingRate", s.settlement_amount AS "settlementAmount",
        s.branch_id AS "branchId", s.branch_snapshot AS "branchSnapshot",
        s.issuer_party_profile_id AS "issuerPartyProfileId",
        s.issuer_party_profile_snapshot AS "issuerPartyProfileSnapshot",
        s.currency_id AS "currencyId", s.currency_snapshot AS "currencySnapshot",
        s.product_id AS "productId", s.product_snapshot AS "productSnapshot",
        c.kit_number AS "kitNumber", ${MASKED_CARD_SQL} AS "maskedCardNumber"
       FROM product_settlements s
       LEFT JOIN card_stock_cards c ON c.id = s.card_id AND s.type = 'CARD'
       LEFT JOIN LATERAL (
         SELECT public.decrypt_card_number(c.card_number) clear_number
         WHERE c.id IS NOT NULL
       ) decoded ON true
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
        (SELECT COUNT(*)::int FROM product_settlements item WHERE item.deleted_at IS NULL AND ((d.kind='BRANCH_HO' AND item.branch_document_id=d.id) OR (d.kind='HO_ISSUER' AND item.issuer_document_id=d.id))) AS "itemCount",
        (SELECT COALESCE(string_agg(codes.code, ', ' ORDER BY codes.code), '')
           FROM (
             SELECT DISTINCT UPPER(TRIM(item.product_code::text)) AS code
               FROM product_settlements item
              WHERE item.deleted_at IS NULL
                AND ((d.kind='BRANCH_HO' AND item.branch_document_id=d.id) OR (d.kind='HO_ISSUER' AND item.issuer_document_id=d.id))
                AND NULLIF(TRIM(item.product_code::text), '') IS NOT NULL
           ) codes
        ) AS "productCodes"
       FROM product_settlement_documents d`;
  }

  private documentListWhere(
    query: ProductSettlementDocumentQueryDto,
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
      add("d.kind = ?", ProductSettlementDocumentKind.BRANCH_HO);
    }
    if (query.status?.length) {
      const placeholders = query.status.map((value) => {
        params.push(value);
        return `$${params.length}`;
      });
      conditions.push(`d.status IN (${placeholders.join(", ")})`);
    }
    const search = query.search?.trim();
    if (search) {
      params.push(`%${search}%`);
      const searchParam = `$${params.length}`;
      conditions.push(`(
        d.transaction_number ILIKE ${searchParam}
        OR COALESCE(d.reference, '') ILIKE ${searchParam}
        OR COALESCE(d.remarks, '') ILIKE ${searchParam}
        OR COALESCE(d.issuer_party_profile_snapshot->>'name', '') ILIKE ${searchParam}
        OR COALESCE(d.issuer_party_profile_snapshot->>'code', '') ILIKE ${searchParam}
        OR COALESCE(d.issuer_party_profile_snapshot->>'label', '') ILIKE ${searchParam}
        OR COALESCE(d.currency_snapshot->>'currencyCode', '') ILIKE ${searchParam}
        OR COALESCE(d.currency_snapshot->>'name', '') ILIKE ${searchParam}
        OR COALESCE(d.currency_snapshot->>'code', '') ILIKE ${searchParam}
        OR COALESCE(d.currency_snapshot->>'label', '') ILIKE ${searchParam}
        OR COALESCE(d.branch_snapshot->>'name', '') ILIKE ${searchParam}
        OR COALESCE(d.branch_snapshot->>'code', '') ILIKE ${searchParam}
        OR COALESCE(d.branch_snapshot->>'label', '') ILIKE ${searchParam}
        OR COALESCE(d.ho_branch_snapshot->>'name', '') ILIKE ${searchParam}
        OR COALESCE(d.ho_branch_snapshot->>'code', '') ILIKE ${searchParam}
        OR COALESCE(d.ho_branch_snapshot->>'label', '') ILIKE ${searchParam}
      )`);
    }
    if (query.kind && this.isHo(session)) add("d.kind = ?", query.kind);
    if (query.issuerPartyProfileId)
      add("d.issuer_party_profile_id = ?", query.issuerPartyProfileId);
    if (query.currencyId) add("d.currency_id = ?", query.currencyId);
    if (query.branchId && this.isHo(session))
      add("d.branch_id = ?", query.branchId);
    const productCode = query.productCode?.trim();
    if (productCode) {
      params.push(productCode.toUpperCase());
      const productParam = `$${params.length}`;
      conditions.push(`EXISTS (
        SELECT 1
          FROM product_settlements item
         WHERE item.deleted_at IS NULL
           AND ((d.kind='BRANCH_HO' AND item.branch_document_id=d.id) OR (d.kind='HO_ISSUER' AND item.issuer_document_id=d.id))
           AND UPPER(TRIM(item.product_code::text)) = ${productParam}
      )`);
    }
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
    query: ProductSettlementDocumentQueryDto,
    session: AuthenticatedSession,
  ) {
    const pagination = normalizePagination(query);
    const where = this.documentListWhere(query, session);
    if ("empty" in where) return buildPaginatedResponse([], 0, pagination);
    const countRows = await this.database2.query(
      `SELECT COUNT(*)::int AS total FROM product_settlement_documents d WHERE ${where.conditions.join(" AND ")}`,
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
      `SELECT s.id, s.type, s.product_code AS "productCode", s.series, s.denomination, s.sale_kind AS "saleKind",
        s.sale_buy_rate AS "saleBuyRate", s.buy_rate AS "buyRate",
        s.booking_rate AS "bookingRate", s.settlement_amount AS "settlementAmount",
        s.issuer_rate AS "issuerRate", s.issuer_settlement_amount AS "issuerSettlementAmount",
        s.status, s.branch_id AS "branchId", s.branch_snapshot AS "branchSnapshot",
        s.product_id AS "productId", s.product_snapshot AS "productSnapshot",
        c.kit_number AS "kitNumber", ${MASKED_CARD_SQL} AS "maskedCardNumber"
       FROM product_settlements s
       LEFT JOIN card_stock_cards c ON c.id = s.card_id AND s.type = 'CARD'
       LEFT JOIN LATERAL (
         SELECT public.decrypt_card_number(c.card_number) clear_number
         WHERE c.id IS NOT NULL
       ) decoded ON true
       WHERE s.deleted_at IS NULL AND ((s.branch_document_id=$1 AND $2='BRANCH_HO') OR (s.issuer_document_id=$1 AND $2='HO_ISSUER'))
       ORDER BY s.created_at`,
      [id, document.kind],
    );
    return { ...document, items };
  }

  async accept(id: string, session: AuthenticatedSession) {
    this.assertHo(session);
    const documentId = await this.database2.transaction(async (manager) => {
      const documentRepo = manager.getRepository(ProductSettlementDocument);
      const document = await documentRepo
        .createQueryBuilder("d")
        .where("d.id = :id", { id })
        .setLock("pessimistic_write")
        .getOne();
      if (!document) throw new NotFoundException("CARD settlement not found");
      if (
        document.kind !== ProductSettlementDocumentKind.BRANCH_HO ||
        document.status !==
          ProductSettlementDocumentStatus.PENDING_HO_ACCEPTANCE ||
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
    dto: RejectProductSettlementDocumentDto,
    session: AuthenticatedSession,
  ) {
    this.assertHo(session);
    await this.database2.transaction(async (manager) => {
      const documentRepo = manager.getRepository(ProductSettlementDocument);
      const itemRepo = manager.getRepository(ProductSettlement);
      const document = await documentRepo
        .createQueryBuilder("d")
        .where("d.id = :id", { id })
        .setLock("pessimistic_write")
        .getOne();
      if (!document) throw new NotFoundException("CARD settlement not found");
      if (
        document.kind !== ProductSettlementDocumentKind.BRANCH_HO ||
        document.status !==
          ProductSettlementDocumentStatus.PENDING_HO_ACCEPTANCE ||
        document.postingTransactionId
      ) {
        throw new BadRequestException(
          "Only pending HO acceptance settlements can be rejected",
        );
      }
      const itemIds: Array<{ id: string }> = await manager.query(
        `SELECT id FROM product_settlements WHERE deleted_at IS NULL AND branch_document_id = $1`,
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
          settlementMode: ProductSettlementMode.MANUAL,
          status: ProductSettlementStatus.PENDING_BRANCH_SETTLEMENT,
          hoRejectedAt: new Date(),
          hoRejectedById: session.userId,
          hoRejectionReason: dto.reason.trim(),
          updatedBy: session.userId,
        });
      }
      await documentRepo.update(document.id, {
        status: ProductSettlementDocumentStatus.REJECTED,
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
    dto: CancelProductSettlementDocumentDto,
    session: AuthenticatedSession,
  ) {
    if (!session?.userId)
      throw new ForbiddenException("User session is required");
    await this.database2.transaction(async (manager) => {
      const documentRepo = manager.getRepository(ProductSettlementDocument);
      const itemRepo = manager.getRepository(ProductSettlement);
      const document = await documentRepo
        .createQueryBuilder("d")
        .where("d.id = :id", { id })
        .setLock("pessimistic_write")
        .getOne();
      if (!document) throw new NotFoundException("CARD settlement not found");
      if (
        document.postingTransactionId ||
        document.status !==
          ProductSettlementDocumentStatus.PENDING_HO_ACCEPTANCE ||
        document.kind !== ProductSettlementDocumentKind.BRANCH_HO
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
        `SELECT id FROM product_settlements WHERE deleted_at IS NULL AND branch_document_id = $1`,
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
          settlementMode: ProductSettlementMode.MANUAL,
          status: ProductSettlementStatus.PENDING_BRANCH_SETTLEMENT,
          updatedBy: session.userId,
        });
      }
      await documentRepo.update(document.id, {
        status: ProductSettlementDocumentStatus.CANCELLED,
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
