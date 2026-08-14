import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Branch } from '../branches/branch.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransactionItem } from '../transactions/entities/transaction-item.entity';
import { TransactionStatus, TransactionTypeProfileEnum } from '../transactions/transactions.enums';
import { CardStockReferenceType, CardStockSettlementStatus } from './card-stock.enums';
import { CardStockCard } from './entities/card-stock-card.entity';
import { CardStockSettlement } from './entities/card-stock-settlement.entity';
import { CardStockTechnicalTransactionService } from './card-stock-technical-transaction.service';
import { BulkSettleCardStockDto, CardStockSettlementQueryDto } from './dto/card-stock-settlement.dto';
import { AuthenticatedSession } from '../auth/types/session-context';
import { DayEndStartProcessService } from '../day-end-start-process/day-end-start-process.service';

@Injectable()
export class CardStockSettlementService {
  private readonly logger = new Logger(CardStockSettlementService.name);
  constructor(
    @InjectDataSource('database2') private readonly database2: DataSource,
    @InjectRepository(CardStockSettlement, 'database2') private readonly settlementRepository: Repository<CardStockSettlement>,
    @InjectRepository(Branch) private readonly branchRepository: Repository<Branch>,
    private readonly technicalTransactionService: CardStockTechnicalTransactionService,
    private readonly dayEndStartProcessService: DayEndStartProcessService,
  ) {}

  private assertHoAccess(session: AuthenticatedSession) {
    if (!session?.userId || (!session.isAdmin && !session.isHo && !session.isHoStaff)) {
      throw new ForbiddenException('Only Admin/HO users can manage CARD issuer settlements');
    }
  }

  private async resolveSellingBranch(sellingBranchId: string) {
    const sellingBranch = await this.branchRepository.findOne({ where: { id: sellingBranchId, isActive: true } });
    if (!sellingBranch) throw new NotFoundException(`Selling branch ${sellingBranchId} not found`);
    return sellingBranch;
  }

  private resolveBuyQuote(item: TransactionItem) {
    const snapshots = [item.productCurrencyRateSnapshot, item.pricingRuleSnapshot, item.currencyRateSnapshot];
    for (const snapshot of snapshots) {
      const buy = snapshot && typeof snapshot === 'object' ? (snapshot as Record<string, unknown>).buy : null;
      const finalRate = buy && typeof buy === 'object'
        ? Number((buy as Record<string, unknown>).finalRate ?? (buy as Record<string, unknown>).appliedFinalRate)
        : NaN;
      if (Number.isFinite(finalRate) && finalRate > 0) {
        return { buyRate: finalRate, snapshot: snapshot as unknown as Record<string, unknown> };
      }
    }
    throw new BadRequestException(`CARD item ${item.lineNo} is missing its approval-time buying-rate snapshot`);
  }

  async assertPersistedBuyRates(items: TransactionItem[]) {
    for (const item of items) this.resolveBuyQuote(item);
  }

  async createForApprovedSale(manager: EntityManager, transaction: Transaction, items: TransactionItem[], actorId: string) {
    if (transaction.status !== TransactionStatus.APPROVED) throw new BadRequestException('CARD settlement requires an approved sale');
    const sellingBranch = await this.resolveSellingBranch(transaction.branchId);
    const settlementRepo = manager.getRepository(CardStockSettlement);
    const cardRepo = manager.getRepository(CardStockCard);
    for (const item of items) {
      if (!item.cardId) continue;
      let settlement = await settlementRepo.findOne({ where: { cardId: item.cardId, transactionItemId: item.id } });
      const card = await cardRepo.findOne({ where: { id: item.cardId }, relations: ['receiptItem', 'receiptItem.receipt'] });
      if (!card?.receiptItem?.receipt || !item.issuerPartyProfileId) throw new BadRequestException(`CARD settlement source is incomplete for item ${item.lineNo}`);
      const hoBranch = await this.branchRepository.findOne({ where: { id: card.receiptItem.receipt.hoBranchId, isActive: true } });
      if (!hoBranch?.isHeadOffice) throw new BadRequestException(`Original HO branch is inactive or invalid for CARD item ${item.lineNo}`);
      const balanceRows = await manager.query(
        `SELECT id, series FROM card_stock_balance WHERE card_id=$1 AND branch_id=$2
         AND (($3::citext IS NULL AND is_active=true) OR series=$3::citext)
         ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        [card.id, transaction.branchId, settlement?.series ?? null],
      );
      if (!balanceRows[0]) throw new BadRequestException(`No active CARD balance exists for item ${item.lineNo}`);
      const quote = settlement
        ? { buyRate: Number(settlement.buyRate), snapshot: settlement.buyRateSnapshot }
        : this.resolveBuyQuote(item);
      const buyRate = quote.buyRate;
      const denomination = Number(item.quantity);
      if (!Number.isFinite(buyRate) || buyRate <= 0 || !Number.isFinite(denomination) || denomination <= 0) {
        throw new BadRequestException(`CARD item ${item.lineNo} has an invalid settlement denomination or buy rate`);
      }
      if (!settlement) settlement = await settlementRepo.save(settlementRepo.create({
        cardId: card.id,
        transactionId: transaction.id,
        transactionItemId: item.id,
        branchId: transaction.branchId,
        branchSnapshot: transaction.branchSnapshot,
        hoBranchId: hoBranch.id,
        hoBranchSnapshot: { id: hoBranch.id, code: hoBranch.code, name: hoBranch.name, label: `${hoBranch.code} - ${hoBranch.name}` },
        issuerPartyProfileId: item.issuerPartyProfileId,
        issuerPartyProfileSnapshot: item.issuerPartyProfileSnapshot ?? card.receiptItem.issuerPartyProfileSnapshot,
        currencyId: item.currencyId,
        currencySnapshot: item.currencySnapshot,
        productId: item.productId,
        productSnapshot: item.productSnapshot,
        passengerId: transaction.passengerId,
        passengerSnapshot: transaction.passengerSnapshot,
        series: String(balanceRows[0].series),
        denomination: denomination.toFixed(2),
        buyRate: buyRate.toFixed(7),
        buyRateSnapshot: quote.snapshot,
        settlementAmount: (denomination * buyRate).toFixed(2),
        saleDate: String(transaction.transactionDate).slice(0, 10),
        branchSettlementDate: null,
        branchSettlementEntryId: null,
        issuerSettlementDate: null,
        issuerReference: null,
        issuerSettlementEntryId: null,
        status: CardStockSettlementStatus.PENDING_ISSUER_SETTLEMENT,
        cancelledAt: null,
        cancelledById: null,
        cancellationReason: null,
        createdBy: actorId,
        updatedBy: actorId,
      }));
      if (settlement.branchSettlementEntryId) {
        await manager.query(
          `UPDATE card_stock_balance SET settle_date=coalesce(settle_date,$2), settle_rate=$3, settle_amount=$4, settle_entry_id=$5, updated_by=$6
           WHERE id=$1 AND settle_entry_id IS NULL`,
          [balanceRows[0].id, settlement.branchSettlementDate ?? transaction.transactionDate, settlement.buyRate, settlement.settlementAmount, settlement.branchSettlementEntryId, actorId],
        );
        continue;
      }
      const existingEntry: Array<{ id: string; date: Date }> = await manager.query(
        `SELECT id, date FROM card_stock_transaction_entries WHERE card_id=$1 AND operation_type='SETTLE' AND reference_type='CARD_BRANCH_SETTLEMENT' AND reference_id=$2 LIMIT 1`,
        [card.id, settlement.id],
      );
      if (existingEntry[0]) {
        await settlementRepo.update(settlement.id, { branchSettlementEntryId: existingEntry[0].id, branchSettlementDate: existingEntry[0].date, updatedBy: actorId });
        await manager.query(
          `UPDATE card_stock_balance SET settle_date=$2, settle_rate=$3, settle_amount=$4, settle_entry_id=$5, updated_by=$6 WHERE id=$1`,
          [balanceRows[0].id, existingEntry[0].date, settlement.buyRate, settlement.settlementAmount, existingEntry[0].id, actorId],
        );
        continue;
      }
      await this.technicalTransactionService.create({
        manager,
        operationCode: TransactionTypeProfileEnum.CARD_SETTLE,
        branch: sellingBranch,
        transactionDate: transaction.transactionDate ?? new Date(),
        referenceType: CardStockReferenceType.CARD_BRANCH_SETTLEMENT,
        referenceId: settlement.id,
        actorId,
        items: [{ cardId: card.id, currencyId: item.currencyId, productId: item.productId, quantity: item.quantity, per: '1', rate: settlement.buyRate, cardSnapshot: item.cardSnapshot ?? undefined }],
      });
    }
  }

  async list(query: CardStockSettlementQueryDto, session: AuthenticatedSession) {
    this.assertHoAccess(session);
    const conditions: string[] = ['s.deleted_at IS NULL'];
    const params: unknown[] = [];
    const add = (sql: string, value: unknown) => { params.push(value); conditions.push(sql.replace('?', `$${params.length}`)); };
    if (query.status) add('s.status = ?', query.status);
    if (query.issuerPartyProfileId) add('s.issuer_party_profile_id = ?', query.issuerPartyProfileId);
    if (query.currencyId) add('s.currency_id = ?', query.currencyId);
    if (query.branchId) add('s.branch_id = ?', query.branchId);
    if (query.saleDateFrom) add('s.sale_date >= ?', query.saleDateFrom);
    if (query.saleDateTo) add('s.sale_date <= ?', query.saleDateTo);
    if (query.settlementDateFrom) add('s.issuer_settlement_date >= ?', query.settlementDateFrom);
    if (query.settlementDateTo) add('s.issuer_settlement_date <= ?', query.settlementDateTo);
    return this.database2.query(`
      SELECT s.id, s.card_id AS "cardId", s.transaction_id AS "transactionId", s.transaction_item_id AS "transactionItemId",
        s.branch_id AS "branchId", s.branch_snapshot AS "branchSnapshot", s.ho_branch_id AS "hoBranchId", s.ho_branch_snapshot AS "hoBranchSnapshot",
        s.issuer_party_profile_id AS "issuerPartyProfileId", s.issuer_party_profile_snapshot AS "issuerPartyProfileSnapshot",
        s.currency_id AS "currencyId", s.currency_snapshot AS "currencySnapshot", s.product_id AS "productId", s.product_snapshot AS "productSnapshot",
        s.passenger_id AS "passengerId", s.passenger_snapshot AS "passengerSnapshot", s.series, s.denomination,
        s.buy_rate AS "buyRate", s.buy_rate_snapshot AS "buyRateSnapshot", s.settlement_amount AS "settlementAmount", s.sale_date AS "saleDate",
        s.branch_settlement_date AS "branchSettlementDate", s.branch_settlement_entry_id AS "branchSettlementEntryId",
        s.issuer_settlement_date AS "issuerSettlementDate", s.issuer_reference AS "issuerReference", s.issuer_settlement_entry_id AS "issuerSettlementEntryId",
        s.status, s.cancelled_at AS "cancelledAt", s.cancelled_by_id AS "cancelledById", s.cancellation_reason AS "cancellationReason",
        s.created_at AS "createdAt", s.updated_at AS "updatedAt", c.series AS "cardSeries", c.kit_number AS "kitNumber",
        CASE WHEN length(clear_number) <= 8 THEN left(clear_number,4)||repeat('X',greatest(length(clear_number)-4,0)) ELSE left(clear_number,4)||repeat('X',length(clear_number)-8)||right(clear_number,4) END AS "maskedCardNumber"
      FROM card_stock_settlements s JOIN card_stock_cards c ON c.id=s.card_id
      CROSS JOIN LATERAL (SELECT public.decrypt_card_number(c.card_number) AS clear_number) decoded
      WHERE ${conditions.join(' AND ')} ORDER BY s.sale_date DESC, s.created_at DESC`, params);
  }

  async get(id: string, session: AuthenticatedSession) {
    this.assertHoAccess(session);
    const rows = await this.list({} as CardStockSettlementQueryDto, session);
    const row = rows.find((item: { id: string }) => item.id === id);
    if (!row) throw new NotFoundException('CARD settlement not found');
    return row;
  }

  async bulkSettle(dto: BulkSettleCardStockDto, session: AuthenticatedSession) {
    this.assertHoAccess(session);
    const uniqueHoBranches = await this.settlementRepository.find({
      select: { hoBranchId: true },
      where: { id: In([...new Set(dto.settlementIds)]) },
    });
    for (const hoBranchId of new Set(uniqueHoBranches.map(row => row.hoBranchId))) {
      await this.dayEndStartProcessService.assertTransactionDateAllowed(hoBranchId, session.userId, dto.issuerSettlementDate);
    }
    return this.database2.transaction(async manager => {
      const repo = manager.getRepository(CardStockSettlement);
      const rows = await repo.createQueryBuilder('settlement').where('settlement.id IN (:...ids)', { ids: [...new Set(dto.settlementIds)] }).setLock('pessimistic_write').getMany();
      if (rows.length !== new Set(dto.settlementIds).size) throw new BadRequestException('One or more CARD settlement items were not found');
      if (rows.some(row => row.status !== CardStockSettlementStatus.PENDING_ISSUER_SETTLEMENT || !row.branchSettlementEntryId)) throw new BadRequestException('Only pending branch-settled CARD items can be settled with the issuer');
      if (rows.some(row => dto.issuerSettlementDate < row.saleDate)) throw new BadRequestException('Issuer settlement date cannot be earlier than the CARD sale date');
      for (const row of rows) {
        const hoBranch = await this.branchRepository.findOne({ where: { id: row.hoBranchId, isActive: true } });
        if (!hoBranch) throw new BadRequestException(`HO branch ${row.hoBranchId} is inactive or missing`);
        await this.technicalTransactionService.create({ manager, operationCode: TransactionTypeProfileEnum.CARD_SETTLE, branch: hoBranch, transactionDate: dto.issuerSettlementDate, referenceType: CardStockReferenceType.CARD_ISSUER_SETTLEMENT, referenceId: row.id, actorId: session.userId, items: [{ cardId: row.cardId, currencyId: row.currencyId, productId: row.productId, quantity: row.denomination, per: '1', rate: row.buyRate }] });
        const persisted = await repo.findOne({ where: { id: row.id } });
        if (!persisted?.issuerSettlementEntryId) throw new BadRequestException(`Issuer settlement ledger entry was not created for ${row.series}`);
        await repo.update(row.id, {
          issuerSettlementDate: dto.issuerSettlementDate,
          issuerReference: dto.issuerReference.trim(),
          status: CardStockSettlementStatus.ISSUER_SETTLED,
          updatedBy: session.userId,
        });
      }
      return repo.find({ where: { id: In(rows.map(row => row.id)) } });
    });
  }

  async cancel(id: string, reason: string, session: AuthenticatedSession) {
    this.assertHoAccess(session);
    const row = await this.settlementRepository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('CARD settlement not found');
    if (row.status !== CardStockSettlementStatus.PENDING_ISSUER_SETTLEMENT) throw new BadRequestException('Only pending issuer settlements can be cancelled');
    row.status = CardStockSettlementStatus.CANCELLED;
    row.cancelledAt = new Date();
    row.cancelledById = session.userId;
    row.cancellationReason = reason.trim();
    row.updatedBy = session.userId;
    return this.settlementRepository.save(row);
  }

  async reconcile() {
    const rows = await this.settlementRepository.find({ where: { status: CardStockSettlementStatus.PENDING_ISSUER_SETTLEMENT, branchSettlementEntryId: null } });
    for (const row of rows) {
      try { await this.database2.transaction(async manager => {
        const locked = await manager.getRepository(CardStockSettlement).createQueryBuilder('settlement')
          .where('settlement.id=:id', { id: row.id })
          .setLock('pessimistic_write')
          .getOne();
        if (!locked || locked.branchSettlementEntryId) return;
        const existingEntry: Array<{ id: string; date: Date }> = await manager.query(
          `SELECT id, date FROM card_stock_transaction_entries WHERE card_id=$1 AND operation_type='SETTLE' AND reference_type='CARD_BRANCH_SETTLEMENT' AND reference_id=$2 LIMIT 1`,
          [locked.cardId, locked.id],
        );
        if (existingEntry[0]) {
          await manager.getRepository(CardStockSettlement).update(locked.id, { branchSettlementEntryId: existingEntry[0].id, branchSettlementDate: existingEntry[0].date });
          await manager.query(
            `UPDATE card_stock_balance SET settle_date=$4, settle_rate=$5, settle_amount=$6, settle_entry_id=$7, updated_by=$8
             WHERE card_id=$1 AND branch_id=$2 AND series=$3::citext`,
            [locked.cardId, locked.branchId, locked.series, existingEntry[0].date, locked.buyRate, locked.settlementAmount, existingEntry[0].id, locked.updatedBy],
          );
          return;
        }
        const branch = await this.branchRepository.findOne({ where: { id: locked.branchId, isActive: true } });
        if (!branch) throw new BadRequestException(`Branch ${locked.branchId} not found during settlement reconciliation`);
        await this.technicalTransactionService.create({ manager, operationCode: TransactionTypeProfileEnum.CARD_SETTLE, branch, transactionDate: locked.saleDate, referenceType: CardStockReferenceType.CARD_BRANCH_SETTLEMENT, referenceId: locked.id, actorId: locked.createdBy, items: [{ cardId: locked.cardId, currencyId: locked.currencyId, productId: locked.productId, quantity: locked.denomination, per: '1', rate: locked.buyRate }] });
      }); } catch (error) { this.logger.error(`Failed to reconcile CARD settlement ${row.id}`, error instanceof Error ? error.stack : String(error)); }
    }
  }
}
