import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { AdditionalSettingService } from '../additional-settings/additional-setting.service';
import { AuthenticatedSession } from '../auth/types/session-context';
import { Branch } from '../branches/branch.entity';
import { toDateOnlyString, toUtcDateOnly, toUtcNextDate } from '../common/date/date.util';
import { DayEndStartProcessService } from '../day-end-start-process/day-end-start-process.service';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransactionItem } from '../transactions/entities/transaction-item.entity';
import { TransactionStatus, TransactionTypeProfileEnum } from '../transactions/transactions.enums';
import { CardStockReferenceType, CardStockSettlementMode, CardStockSettlementStatus } from './card-stock.enums';
import { CardStockTransactionService } from './card-stock-transaction.service';
import { AcceptBranchCardSettlementDto, BulkSettleCardStockDto, CardStockSettlementQueryDto, RejectBranchCardSettlementDto, SubmitBranchCardSettlementDto } from './dto/card-stock-settlement.dto';
import { CardStockCard } from './entities/card-stock-card.entity';
import { CardStockSettlement } from './entities/card-stock-settlement.entity';

@Injectable()
export class CardStockSettlementService {
  private readonly logger = new Logger(CardStockSettlementService.name);
  constructor(
    @InjectDataSource('database2') private readonly database2: DataSource,
    @InjectRepository(CardStockSettlement, 'database2') private readonly settlementRepository: Repository<CardStockSettlement>,
    @InjectRepository(Branch) private readonly branchRepository: Repository<Branch>,
    private readonly additionalSettingService: AdditionalSettingService,
    private readonly cardStockTransactionService: CardStockTransactionService,
    private readonly dayEndStartProcessService: DayEndStartProcessService,
  ) {}

  private isHo(session: AuthenticatedSession) { return Boolean(session?.isAdmin || session?.isHo || session?.isHoStaff); }
  private assertHo(session: AuthenticatedSession) { if (!session?.userId || !this.isHo(session)) throw new ForbiddenException('Only Admin/HO users can perform this action'); }
  private assertBranchAccess(rows: CardStockSettlement[], session: AuthenticatedSession) {
    if (!session?.userId) throw new ForbiddenException('User session is required');
    if (!this.isHo(session) && rows.some(row => row.branchId !== session.activeBranchId)) throw new ForbiddenException('Settlement items must belong to the current branch');
  }
  private clean(value?: string) { return value?.trim() || null; }
  private toTimestamp(value: Date | string | null | undefined, message: string): Date {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return new Date(value.getTime());
    }
    const isoDate = toDateOnlyString(value);
    if (!isoDate) {
      throw new BadRequestException(message);
    }
    return toUtcDateOnly(isoDate);
  }
  private isCalendarBefore(left: Date | string | null | undefined, right: Date | string | null | undefined) {
    const leftDate = toDateOnlyString(left);
    const rightDate = toDateOnlyString(right);
    return Boolean(leftDate && rightDate && leftDate < rightDate);
  }
  private resolveBuyQuote(item: TransactionItem) {
    for (const snapshot of [item.productCurrencyRateSnapshot, item.pricingRuleSnapshot, item.currencyRateSnapshot]) {
      const buy = snapshot && typeof snapshot === 'object' ? (snapshot as Record<string, unknown>).buy : null;
      const rate = buy && typeof buy === 'object' ? Number((buy as Record<string, unknown>).finalRate ?? (buy as Record<string, unknown>).appliedFinalRate) : NaN;
      if (Number.isFinite(rate) && rate > 0) return { buyRate: rate, snapshot: snapshot as Record<string, unknown> };
    }
    throw new BadRequestException(`CARD item ${item.lineNo} is missing its approval-time buying-rate snapshot`);
  }
  async assertPersistedBuyRates(items: TransactionItem[]) { for (const item of items) this.resolveBuyQuote(item); }

  private async getBranch(id: string) {
    const branch = await this.branchRepository.findOne({ where: { id, isActive: true }, relations: ['company'] });
    if (!branch) throw new NotFoundException(`Active branch ${id} was not found`);
    return branch;
  }
  private async getSettlementHo(receiptBranchId: string, sellingBranch: Branch) {
    if (sellingBranch.isHeadOffice) return sellingBranch;
    const receiptBranch = await this.branchRepository.findOne({ where: { id: receiptBranchId, isActive: true }, relations: ['company'] });
    if (receiptBranch?.isHeadOffice) return receiptBranch;
    const companyId = sellingBranch.company?.id ?? receiptBranch?.company?.id;
    const query = this.branchRepository.createQueryBuilder('branch')
      .leftJoinAndSelect('branch.company', 'company')
      .where('branch.isHeadOffice = true AND branch.isActive = true')
      .orderBy('branch.createdAt', 'ASC');
    if (companyId) query.andWhere('company.id = :companyId', { companyId });
    const ho = await query.getOne();
    if (!ho) throw new BadRequestException('An active HO branch is required for CARD settlement');
    return ho;
  }

  async createForApprovedSale(manager: EntityManager, transaction: Transaction, items: TransactionItem[], actorId: string) {
    if (transaction.status !== TransactionStatus.APPROVED) throw new BadRequestException('CARD settlement requires an approved sale');
    const sellingBranch = await this.getBranch(transaction.branchId);
    const auto = await this.additionalSettingService.getSettingBooleanValue('CARD_SETTINGS', 'AUTO_SETTLE_CARD_WITH_HO', true);
    const mode = auto ? CardStockSettlementMode.AUTO : CardStockSettlementMode.MANUAL;
    const repo = manager.getRepository(CardStockSettlement);
    const cardRepo = manager.getRepository(CardStockCard);
    const saleRows: CardStockSettlement[] = [];
    for (const item of items) {
      if (!item.cardId) continue;
      let row = await repo.findOne({ where: { cardId: item.cardId, transactionItemId: item.id } });
      if (!row) {
        const card = await cardRepo.findOne({ where: { id: item.cardId }, relations: ['receiptItem', 'receiptItem.receipt'] });
        if (!card?.receiptItem?.receipt || !item.issuerPartyProfileId) throw new BadRequestException(`CARD settlement source is incomplete for item ${item.lineNo}`);
        const ho = await this.getSettlementHo(card.receiptItem.receipt.branchId, sellingBranch);
        const balance = (await manager.query(`SELECT id,series FROM card_stock_balance WHERE card_id=$1 AND branch_id=$2 AND is_active=true ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [card.id, transaction.branchId]))[0];
        if (!balance) throw new BadRequestException(`No active CARD balance exists for item ${item.lineNo}`);
        const quote = this.resolveBuyQuote(item);
        const denomination = Number(item.quantity);
        row = await repo.save(repo.create({
          cardId: card.id, transactionId: transaction.id, transactionItemId: item.id,
          branchId: sellingBranch.id, branchSnapshot: transaction.branchSnapshot,
          hoBranchId: ho.id, hoBranchSnapshot: { id: ho.id, code: ho.code, name: ho.name, label: `${ho.code} - ${ho.name}` },
          issuerPartyProfileId: item.issuerPartyProfileId, issuerPartyProfileSnapshot: item.issuerPartyProfileSnapshot ?? card.receiptItem.issuerPartyProfileSnapshot,
          currencyId: item.currencyId, currencySnapshot: item.currencySnapshot, productId: item.productId, productSnapshot: item.productSnapshot,
          passengerId: transaction.passengerId, passengerSnapshot: transaction.passengerSnapshot, series: String(balance.series), denomination: denomination.toFixed(2),
          buyRate: quote.buyRate.toFixed(7), buyRateSnapshot: quote.snapshot, settlementAmount: (denomination * quote.buyRate).toFixed(2), saleDate: this.toTimestamp(transaction.transactionDate, `CARD item ${item.lineNo} is missing a sale date`),
          settlementMode: mode, branchRequestedDate: auto ? this.toTimestamp(transaction.transactionDate, `CARD item ${item.lineNo} is missing a sale date`) : null, branchReference: null, branchRemarks: null,
          branchRequestedAt: auto ? new Date() : null, branchRequestedById: auto ? actorId : null, hoAcceptedAt: null, hoAcceptedById: null, hoRejectedAt: null, hoRejectedById: null, hoRejectionReason: null,
          branchSettlementDate: null, branchSettlementEntryId: null, issuerSettlementDate: null, issuerReference: null, issuerRemarks: null, issuerSettlementEntryId: null,
          status: auto && sellingBranch.id !== ho.id ? CardStockSettlementStatus.PENDING_HO_ACCEPTANCE : CardStockSettlementStatus.PENDING_BRANCH_SETTLEMENT,
          cancelledAt: null, cancelledById: null, cancellationReason: null, createdBy: actorId, updatedBy: actorId,
        }));
      }
      saleRows.push(row);
    }
    const selfAutoRows = saleRows.filter(row => row.settlementMode === CardStockSettlementMode.AUTO && row.branchId === row.hoBranchId && row.status === CardStockSettlementStatus.PENDING_BRANCH_SETTLEMENT);
    if (selfAutoRows.length) await this.completeBranchSettlement(manager, selfAutoRows, actorId, false);
  }

  private groupRows(rows: CardStockSettlement[], key: (row: CardStockSettlement) => string) {
    return rows.reduce<Map<string, CardStockSettlement[]>>((groups, row) => groups.set(key(row), [...(groups.get(key(row)) ?? []), row]), new Map());
  }
  private async completeBranchSettlement(manager: EntityManager, rows: CardStockSettlement[], actorId: string, acceptedByHo: boolean) {
    const repo = manager.getRepository(CardStockSettlement);
    const groups = this.groupRows(rows, row => `${row.branchId}:${toDateOnlyString(row.branchRequestedDate)}`);
    for (const group of groups.values()) {
      const branch = await this.getBranch(group[0].branchId);
      const date = this.toTimestamp(group[0].branchRequestedDate ?? group[0].saleDate, 'CARD settlement date is invalid');
      await this.dayEndStartProcessService.assertTransactionDateAllowed(branch.id, actorId, date);
      await this.cardStockTransactionService.create({
        manager, operationCode: TransactionTypeProfileEnum.CARD_SETTLE, branch, transactionDate: date, actorId,
        items: group.map(row => ({ cardId: row.cardId, currencyId: row.currencyId, productId: row.productId, quantity: row.denomination, per: '1', rate: row.buyRate, referenceType: CardStockReferenceType.CARD_BRANCH_SETTLEMENT, referenceId: row.id })),
      });
      for (const row of group) {
        const persisted = await repo.findOne({ where: { id: row.id } });
        if (!persisted?.branchSettlementEntryId) throw new BadRequestException(`Branch settlement ledger entry was not created for ${row.series}`);
        await repo.update(row.id, { status: CardStockSettlementStatus.PENDING_ISSUER_SETTLEMENT, hoAcceptedAt: acceptedByHo ? new Date() : row.hoAcceptedAt, hoAcceptedById: acceptedByHo ? actorId : row.hoAcceptedById, updatedBy: actorId });
      }
    }
  }

  async submitBranch(dto: SubmitBranchCardSettlementDto, session: AuthenticatedSession) {
    return this.database2.transaction(async manager => {
      const repo = manager.getRepository(CardStockSettlement);
      const rows = await repo.createQueryBuilder('s').where('s.id IN (:...ids)', { ids: [...new Set(dto.settlementIds)] }).setLock('pessimistic_write').getMany();
      if (rows.length !== new Set(dto.settlementIds).size || rows.some(row => row.status !== CardStockSettlementStatus.PENDING_BRANCH_SETTLEMENT)) throw new BadRequestException('Only unsettled CARD items can be submitted');
      this.assertBranchAccess(rows, session);
      const settlementDate = this.toTimestamp(dto.settlementDate, 'Settlement date is invalid');
      if (rows.some(row => this.isCalendarBefore(settlementDate, row.saleDate))) throw new BadRequestException('Settlement date cannot be before the CARD sale date');
      for (const branchId of new Set(rows.map(row => row.branchId))) {
        await this.dayEndStartProcessService.assertTransactionDateAllowed(branchId, session.userId, settlementDate);
      }
      for (const row of rows) await repo.update(row.id, { branchRequestedDate: settlementDate, branchReference: this.clean(dto.reference), branchRemarks: this.clean(dto.remarks), branchRequestedAt: new Date(), branchRequestedById: session.userId, hoRejectedAt: null, hoRejectedById: null, hoRejectionReason: null, status: row.branchId === row.hoBranchId ? CardStockSettlementStatus.PENDING_BRANCH_SETTLEMENT : CardStockSettlementStatus.PENDING_HO_ACCEPTANCE, updatedBy: session.userId });
      const self = rows.filter(row => row.branchId === row.hoBranchId).map(row => ({ ...row, branchRequestedDate: settlementDate } as CardStockSettlement));
      if (self.length) await this.completeBranchSettlement(manager, self, session.userId, false);
      return repo.find({ where: { id: In(rows.map(row => row.id)) } });
    });
  }

  async acceptBranch(dto: AcceptBranchCardSettlementDto, session: AuthenticatedSession) {
    this.assertHo(session);
    return this.database2.transaction(async manager => {
      const repo = manager.getRepository(CardStockSettlement);
      const rows = await repo.createQueryBuilder('s').where('s.id IN (:...ids)', { ids: [...new Set(dto.settlementIds)] }).setLock('pessimistic_write').getMany();
      if (rows.length !== new Set(dto.settlementIds).size || rows.some(row => row.status !== CardStockSettlementStatus.PENDING_HO_ACCEPTANCE || !row.branchRequestedDate)) throw new BadRequestException('Only pending HO acceptance items can be accepted');
      await this.completeBranchSettlement(manager, rows, session.userId, true);
      return repo.find({ where: { id: In(rows.map(row => row.id)) } });
    });
  }

  async rejectBranch(dto: RejectBranchCardSettlementDto, session: AuthenticatedSession) {
    this.assertHo(session);
    return this.database2.transaction(async manager => {
      const repo = manager.getRepository(CardStockSettlement);
      const rows = await repo.createQueryBuilder('s').where('s.id IN (:...ids)', { ids: [...new Set(dto.settlementIds)] }).setLock('pessimistic_write').getMany();
      if (rows.length !== new Set(dto.settlementIds).size || rows.some(row => row.status !== CardStockSettlementStatus.PENDING_HO_ACCEPTANCE)) throw new BadRequestException('Only pending HO acceptance items can be rejected');
      for (const row of rows) await repo.update(row.id, { status: CardStockSettlementStatus.PENDING_BRANCH_SETTLEMENT, hoRejectedAt: new Date(), hoRejectedById: session.userId, hoRejectionReason: dto.reason.trim(), updatedBy: session.userId });
      return repo.find({ where: { id: In(rows.map(row => row.id)) } });
    });
  }

  async bulkSettle(dto: BulkSettleCardStockDto, session: AuthenticatedSession) {
    this.assertHo(session);
    return this.database2.transaction(async manager => {
      const repo = manager.getRepository(CardStockSettlement);
      const rows = await repo.createQueryBuilder('s').where('s.id IN (:...ids)', { ids: [...new Set(dto.settlementIds)] }).setLock('pessimistic_write').getMany();
      if (rows.length !== new Set(dto.settlementIds).size || rows.some(row => row.status !== CardStockSettlementStatus.PENDING_ISSUER_SETTLEMENT || !row.branchSettlementEntryId)) throw new BadRequestException('Only branch-settled CARD items can be settled with issuers');
      const issuerSettlementDate = this.toTimestamp(dto.issuerSettlementDate, 'Issuer settlement date is invalid');
      if (rows.some(row => this.isCalendarBefore(issuerSettlementDate, row.branchSettlementDate ?? row.saleDate))) throw new BadRequestException('Issuer settlement date cannot be before the branch settlement date');
      for (const group of this.groupRows(rows, row => row.hoBranchId).values()) {
        const ho = await this.getBranch(group[0].hoBranchId);
        await this.dayEndStartProcessService.assertTransactionDateAllowed(ho.id, session.userId, issuerSettlementDate);
        await this.cardStockTransactionService.create({ manager, operationCode: TransactionTypeProfileEnum.CARD_SETTLE, branch: ho, transactionDate: issuerSettlementDate, actorId: session.userId, items: group.map(row => ({ cardId: row.cardId, currencyId: row.currencyId, productId: row.productId, quantity: row.denomination, per: '1', rate: row.buyRate, referenceType: CardStockReferenceType.CARD_ISSUER_SETTLEMENT, referenceId: row.id })) });
        for (const row of group) {
          const persisted = await repo.findOne({ where: { id: row.id } });
          if (!persisted?.issuerSettlementEntryId) throw new BadRequestException(`Issuer settlement ledger entry was not created for ${row.series}`);
          await repo.update(row.id, { issuerSettlementDate, issuerReference: dto.issuerReference.trim(), issuerRemarks: this.clean(dto.remarks), status: CardStockSettlementStatus.ISSUER_SETTLED, updatedBy: session.userId });
        }
      }
      return repo.find({ where: { id: In(rows.map(row => row.id)) } });
    });
  }

  async list(query: CardStockSettlementQueryDto, session: AuthenticatedSession) {
    const conditions = ['s.deleted_at IS NULL']; const params: unknown[] = [];
    const add = (sql: string, value: unknown) => { params.push(value); conditions.push(sql.replace('?', `$${params.length}`)); };
    if (!this.isHo(session)) { if (!session.activeBranchId) return []; add('s.branch_id = ?', session.activeBranchId); }
    if (query.status) add('s.status = ?', query.status); if (query.issuerPartyProfileId) add('s.issuer_party_profile_id = ?', query.issuerPartyProfileId); if (query.currencyId) add('s.currency_id = ?', query.currencyId); if (query.branchId && this.isHo(session)) add('s.branch_id = ?', query.branchId);
    if (query.saleDateFrom) add('s.sale_date >= ?', this.toTimestamp(query.saleDateFrom, 'Sale date from is invalid'));
    if (query.saleDateTo) add('s.sale_date < ?', toUtcNextDate(query.saleDateTo) ?? this.toTimestamp(query.saleDateTo, 'Sale date to is invalid'));
    if (query.settlementDateFrom) add('s.issuer_settlement_date >= ?', this.toTimestamp(query.settlementDateFrom, 'Settlement date from is invalid'));
    if (query.settlementDateTo) add('s.issuer_settlement_date < ?', toUtcNextDate(query.settlementDateTo) ?? this.toTimestamp(query.settlementDateTo, 'Settlement date to is invalid'));
    return this.database2.query(`SELECT s.*, s.card_id AS "cardId",s.transaction_id AS "transactionId",s.transaction_item_id AS "transactionItemId",s.branch_id AS "branchId",s.branch_snapshot AS "branchSnapshot",s.ho_branch_id AS "hoBranchId",s.ho_branch_snapshot AS "hoBranchSnapshot",s.issuer_party_profile_id AS "issuerPartyProfileId",s.issuer_party_profile_snapshot AS "issuerPartyProfileSnapshot",s.currency_id AS "currencyId",s.currency_snapshot AS "currencySnapshot",s.product_id AS "productId",s.product_snapshot AS "productSnapshot",s.passenger_id AS "passengerId",s.passenger_snapshot AS "passengerSnapshot",s.buy_rate AS "buyRate",s.buy_rate_snapshot AS "buyRateSnapshot",s.settlement_amount AS "settlementAmount",s.sale_date AS "saleDate",s.settlement_mode AS "settlementMode",s.branch_requested_date AS "branchRequestedDate",s.branch_reference AS "branchReference",s.branch_remarks AS "branchRemarks",s.branch_requested_at AS "branchRequestedAt",s.branch_requested_by_id AS "branchRequestedById",s.branch_settlement_date AS "branchSettlementDate",s.branch_settlement_entry_id AS "branchSettlementEntryId",s.ho_accepted_at AS "hoAcceptedAt",s.ho_accepted_by_id AS "hoAcceptedById",s.ho_rejected_at AS "hoRejectedAt",s.ho_rejected_by_id AS "hoRejectedById",s.ho_rejection_reason AS "hoRejectionReason",s.issuer_settlement_date AS "issuerSettlementDate",s.issuer_reference AS "issuerReference",s.issuer_remarks AS "issuerRemarks",s.issuer_settlement_entry_id AS "issuerSettlementEntryId",c.series AS "cardSeries",c.kit_number AS "kitNumber",CASE WHEN length(clear_number)<=8 THEN left(clear_number,4)||repeat('X',greatest(length(clear_number)-4,0)) ELSE left(clear_number,4)||repeat('X',length(clear_number)-8)||right(clear_number,4) END AS "maskedCardNumber" FROM card_stock_settlements s JOIN card_stock_cards c ON c.id=s.card_id CROSS JOIN LATERAL(SELECT public.decrypt_card_number(c.card_number) clear_number) decoded WHERE ${conditions.join(' AND ')} ORDER BY s.sale_date DESC,s.created_at DESC`, params);
  }
  async get(id: string, session: AuthenticatedSession) { const row = (await this.list({} as CardStockSettlementQueryDto, session)).find((item: { id: string }) => item.id === id); if (!row) throw new NotFoundException('CARD settlement not found'); return row; }
  async cancel(id: string, reason: string, session: AuthenticatedSession) {
    const row = await this.settlementRepository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('CARD settlement not found');
    if (row.status === CardStockSettlementStatus.ISSUER_SETTLED || row.status === CardStockSettlementStatus.CANCELLED) throw new BadRequestException('Completed or cancelled settlement cannot be cancelled');
    if (row.status === CardStockSettlementStatus.PENDING_ISSUER_SETTLEMENT) this.assertHo(session);
    else this.assertBranchAccess([row], session);
    row.status = CardStockSettlementStatus.CANCELLED;
    row.cancelledAt = new Date();
    row.cancelledById = session.userId;
    row.cancellationReason = reason.trim();
    row.updatedBy = session.userId;
    return this.settlementRepository.save(row);
  }
  async reconcile() { /* Approval and explicit settlement actions are atomic; pending manual/acceptance rows must remain untouched. */ }
}
