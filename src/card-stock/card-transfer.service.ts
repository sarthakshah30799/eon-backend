import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AdditionalSettingService } from '../additional-settings/additional-setting.service';
import { Branch } from '../branches/branch.entity';
import { Currency } from '../currencies/currency.entity';
import { DayEndStartProcessService } from '../day-end-start-process/day-end-start-process.service';
import { WorkflowStatus } from '../common/enums/workflow-status.enum';
import { loadEntitySnapshot } from '../common/snapshot/entity-snapshot.util';
import { PartyProfile, ClientType } from '../party-profiles/party-profile.entity';
import { Product } from '../products/product.entity';
import { ProductCardIssuer } from '../products/entities/product-card-issuer.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../user-roles/user-role.entity';
import { MailService } from '../mail/mail.service';
import { AuthenticatedSession } from '../auth/types/session-context';
import { TransactionTypeProfileEnum } from '../transactions/transactions.enums';
import { CardStockCard } from './entities/card-stock-card.entity';
import { CardTransferRequest } from './entities/card-transfer-request.entity';
import { CardTransferRequestCard } from './entities/card-transfer-request-card.entity';
import { CardTransferRequestItem } from './entities/card-transfer-request-item.entity';
import { CardStockCardStatus, CardStockReferenceType, CardTransferStatus } from './card-stock.enums';
import { CardTransferItemDto, CreateCardTransferDto } from './dto/card-transfer.dto';
import { CardStockTransactionService } from './card-stock-transaction.service';
import { TransactionReferenceSnapshot } from '../transactions/types/transaction-snapshot.types';

@Injectable()
export class CardTransferService {
  constructor(
    @InjectDataSource('database2') private readonly database2: DataSource,
    @InjectRepository(CardTransferRequest, 'database2') private readonly requestRepository: Repository<CardTransferRequest>,
    @InjectRepository(CardTransferRequestItem, 'database2') private readonly itemRepository: Repository<CardTransferRequestItem>,
    @InjectRepository(CardTransferRequestCard, 'database2') private readonly selectionRepository: Repository<CardTransferRequestCard>,
    @InjectRepository(CardStockCard, 'database2') private readonly cardRepository: Repository<CardStockCard>,
    @InjectRepository(Branch) private readonly branchRepository: Repository<Branch>,
    @InjectRepository(Currency) private readonly currencyRepository: Repository<Currency>,
    @InjectRepository(Product) private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductCardIssuer) private readonly productIssuerRepository: Repository<ProductCardIssuer>,
    @InjectRepository(PartyProfile) private readonly partyProfileRepository: Repository<PartyProfile>,
    @InjectRepository(UserRole) private readonly userRoleRepository: Repository<UserRole>,
    private readonly additionalSettingService: AdditionalSettingService,
    private readonly dayEndStartProcessService: DayEndStartProcessService,
    private readonly mailService: MailService,
    private readonly cardStockTransactionService: CardStockTransactionService,
  ) {}

  private isHoAccess(session: AuthenticatedSession) {
    return Boolean(session.isAdmin || session.isHo || session.isHoStaff);
  }

  private assertHoAccess(session: AuthenticatedSession) {
    if (!this.isHoAccess(session)) throw new ForbiddenException('Only Admin/HO users can manage CARD transfer requests');
  }

  private async resolveBranches(sourceBranchId: string, destinationBranchId: string) {
    const [source, destination] = await Promise.all([
      this.branchRepository.findOne({ where: { id: sourceBranchId, isActive: true } }),
      this.branchRepository.findOne({ where: { id: destinationBranchId, isActive: true } }),
    ]);
    if (!source?.isHeadOffice) throw new BadRequestException('Source branch must be an active HO branch');
    if (!destination) throw new BadRequestException('Destination branch must be active');
    if (source.id === destination.id) throw new BadRequestException('Source and destination branches must be different');
    return { source, destination };
  }

  private async validateItem(item: CardTransferItemDto, cardsById: Map<string, CardStockCard>) {
    const [currency, product, issuer] = await Promise.all([
      this.currencyRepository.findOne({ where: { id: item.currencyId, active: true } }),
      this.productRepository.findOne({ where: { id: item.productId } }),
      this.partyProfileRepository.findOne({ where: { id: item.issuerPartyProfileId, active: true, status: WorkflowStatus.APPROVE, type: ClientType.CARD_ISSUER_PROFILE } as any }),
    ]);
    if (!currency) throw new BadRequestException(`Item ${item.lineNo}: currency is invalid or inactive`);
    if (!product || !product.isActiveProduct || product.productCode.toUpperCase() !== 'CC') throw new BadRequestException(`Item ${item.lineNo}: only active CARD product CC is allowed`);
    if (!issuer) throw new BadRequestException(`Item ${item.lineNo}: issuer profile is invalid, inactive, or not approved`);
    const link = await this.productIssuerRepository.findOne({ where: { productId: product.id, partyProfileId: issuer.id } });
    if (!link) throw new BadRequestException(`Item ${item.lineNo}: issuer is not configured for product CC`);
    if (!item.cardIds?.length) throw new BadRequestException(`Item ${item.lineNo}: at least one card is required`);

    const uniqueIds = new Set(item.cardIds);
    if (uniqueIds.size !== item.cardIds.length) throw new BadRequestException(`Item ${item.lineNo}: duplicate card selection is not allowed`);
    let feAmount = 0;
    for (const id of item.cardIds) {
      const card = cardsById.get(id);
      if (!card) throw new BadRequestException(`Item ${item.lineNo}: selected card ${id} is unavailable`);
      if (card.receiptItem?.currencyId !== currency.id || card.receiptItem?.productId !== product.id || card.receiptItem?.issuerPartyProfileId !== issuer.id) {
        throw new BadRequestException(`Item ${item.lineNo}: selected card ${id} does not match currency, product, or issuer`);
      }
      feAmount += Number(card.amount);
    }
    return { currency, product, issuer, feAmount };
  }

  private async loadLockedCards(manager: import('typeorm').EntityManager, ids: string[], sourceBranchId?: string, transferId?: string) {
    if (!ids.length) throw new BadRequestException('At least one CARD stock record is required');
    const cards = await manager.getRepository(CardStockCard).createQueryBuilder('card')
      .leftJoinAndSelect('card.receiptItem', 'receiptItem')
      .where('card.id IN (:...ids)', { ids })
      .setLock('pessimistic_write', undefined, ['card'])
      .getMany();
    if (cards.length !== ids.length) throw new BadRequestException('One or more selected CARD stock records were not found');
    for (const card of cards) {
      if (sourceBranchId && card.currentBranchId !== sourceBranchId) throw new BadRequestException('Selected card is not held by the source branch');
      if (card.status !== CardStockCardStatus.AVAILABLE && card.reservedByTransferId !== transferId) throw new BadRequestException('One or more selected cards are already reserved or unavailable');
    }
    return new Map(cards.map(card => [card.id, card]));
  }

  async list(session: AuthenticatedSession, params?: { status?: string; search?: string }) {
    const qb = this.requestRepository.createQueryBuilder('request')
      .leftJoinAndSelect('request.items', 'item')
      .leftJoinAndSelect('item.selectedCards', 'selection')
      .leftJoinAndSelect('selection.card', 'card')
      .orderBy('request.createdAt', 'DESC');
    if (params?.status) qb.andWhere('request.status = :status', { status: params.status });
    if (params?.search) qb.andWhere('(request.transactionNumber ILIKE :search OR request.sourceBranchId::text ILIKE :search OR request.destinationBranchId::text ILIKE :search)', { search: `%${params.search.trim()}%` });
    if (!this.isHoAccess(session)) {
      if (!session.activeBranchId) return [];
      qb.andWhere('(request.sourceBranchId = :branchId OR request.destinationBranchId = :branchId)', { branchId: session.activeBranchId });
    }
    return this.withBranchObjects(await qb.getMany());
  }

  async findById(id: string, session: AuthenticatedSession) {
    const request = await this.requestRepository.findOne({ where: { id }, relations: { items: { selectedCards: { card: true } } } });
    if (!request) throw new NotFoundException('CARD transfer request not found');
    if (!this.isHoAccess(session) && session.activeBranchId !== request.sourceBranchId && session.activeBranchId !== request.destinationBranchId) throw new ForbiddenException('You cannot view this CARD transfer request');
    return (await this.withBranchObjects([request]))[0];
  }

  async availableCards(sourceBranchId: string, session: AuthenticatedSession) {
    this.assertHoAccess(session);
    const branch = await this.branchRepository.findOne({ where: { id: sourceBranchId, isActive: true } });
    if (!branch?.isHeadOffice) throw new BadRequestException('Source branch must be an active HO branch');
    const cards = await this.cardRepository.find({ where: { currentBranchId: sourceBranchId, status: CardStockCardStatus.AVAILABLE }, relations: ['receiptItem'], order: { series: 'ASC', kitNumber: 'ASC' } });
    const decrypted = await this.database2.query(
      'SELECT id, public.decrypt_card_number(card_number) AS "cardNumber" FROM card_stock_cards WHERE id = ANY($1::uuid[])',
      [cards.map(card => card.id)],
    );
    const numberById = new Map(decrypted.map((row: { id: string; cardNumber: string }) => {
      const value = String(row.cardNumber ?? '');
      return [row.id, value.length > 8 ? `${value.slice(0, 4)}${'X'.repeat(value.length - 8)}${value.slice(-4)}` : value];
    }));
    return cards.map(card => ({ id: card.id, series: card.series, kitNumber: card.kitNumber, maskedCardNumber: numberById.get(card.id) ?? null, currencyCode: card.receiptItem?.currencySnapshot?.currencyCode ?? '', productCode: card.receiptItem?.productSnapshot?.productCode ?? '', issuerName: card.receiptItem?.issuerPartyProfileSnapshot?.name ?? '', denomination: card.denomination, amount: card.amount, expirationDate: card.expirationDate }));
  }

  async create(dto: CreateCardTransferDto, session: AuthenticatedSession) {
    this.assertHoAccess(session);
    const { source, destination } = await this.resolveBranches(dto.sourceBranchId, dto.destinationBranchId);
    const policy = await this.dayEndStartProcessService.assertTransactionDateAllowed(source.id, session.userId, dto.transactionDate);
    const transactionDate = policy.allowedDate;
    const flatIds = dto.items.flatMap(item => item.cardIds);
    if (new Set(flatIds).size !== flatIds.length) throw new BadRequestException('A card can be selected only once in a transfer request');
    const branchSnapshot = await loadEntitySnapshot(this.branchRepository, source.id);
    const destinationSnapshot = await loadEntitySnapshot(this.branchRepository, destination.id);
    const transactionNumber = await this.additionalSettingService.reserveTransactionNumber(TransactionTypeProfileEnum.CARD_TRANSFER_SELL, source.code, new Date(`${transactionDate}T00:00:00`));
    const saved = await this.database2.transaction(async manager => {
      const cardsById = await this.loadLockedCards(manager, flatIds, source.id);
      let total = 0;
      const validated = [];
      for (const item of dto.items) { const result = await this.validateItem(item, cardsById); total += result.feAmount; validated.push({ item, ...result }); }
      const requestRepo = manager.getRepository(CardTransferRequest);
      const request = await requestRepo.save(requestRepo.create({ transactionNumber, transactionDate, sourceBranchId: source.id, sourceBranchSnapshot: branchSnapshot ?? {}, destinationBranchId: destination.id, destinationBranchSnapshot: destinationSnapshot ?? {}, status: CardTransferStatus.HELD, totalFeAmount: total.toFixed(2), remarks: dto.remarks?.trim() || null, heldAt: new Date(), heldById: session.userId, createdBy: session.userId, updatedBy: session.userId }));
      const itemRepo = manager.getRepository(CardTransferRequestItem);
      const selectionRepo = manager.getRepository(CardTransferRequestCard);
      for (const row of validated) {
        const savedItem = await itemRepo.save(itemRepo.create({ transferId: request.id, lineNo: row.item.lineNo, currencyId: row.currency.id, currencySnapshot: await loadEntitySnapshot(this.currencyRepository, row.currency.id) ?? {}, per: row.item.per, productId: row.product.id, productSnapshot: await loadEntitySnapshot(this.productRepository, row.product.id) ?? {}, issuerPartyProfileId: row.issuer.id, issuerPartyProfileSnapshot: await loadEntitySnapshot(this.partyProfileRepository, row.issuer.id) ?? {}, feAmount: row.feAmount.toFixed(2), createdBy: session.userId, updatedBy: session.userId }));
        await selectionRepo.save(row.item.cardIds.map(cardId => selectionRepo.create({ transferId: request.id, transferItemId: savedItem.id, cardId, createdBy: session.userId, updatedBy: session.userId })));
      }
      for (const card of cardsById.values()) { card.status = CardStockCardStatus.RESERVED; card.reservedByTransferId = request.id; card.reservedAt = new Date(); card.updatedBy = session.userId; }
      await manager.getRepository(CardStockCard).save([...cardsById.values()]);
      return request;
    });
    await this.notifyBranchUsers(destination.id, `CARD transfer ${transactionNumber} submitted`, `CARD transfer request ${transactionNumber} is awaiting acceptance.`);
    return this.findById(saved.id, session);
  }

  async update(id: string, dto: CreateCardTransferDto, session: AuthenticatedSession) {
    this.assertHoAccess(session);
    const { source, destination } = await this.resolveBranches(dto.sourceBranchId, dto.destinationBranchId);
    const policy = await this.dayEndStartProcessService.assertTransactionDateAllowed(source.id, session.userId, dto.transactionDate);
    const flatIds = dto.items.flatMap(item => item.cardIds);
    if (new Set(flatIds).size !== flatIds.length) throw new BadRequestException('A card can be selected only once in a transfer request');
    const sourceSnapshot = await loadEntitySnapshot(this.branchRepository, source.id);
    const destinationSnapshot = await loadEntitySnapshot(this.branchRepository, destination.id);
    const saved = await this.database2.transaction(async manager => {
      const request = await manager.getRepository(CardTransferRequest).createQueryBuilder('request').where('request.id = :id', { id }).setLock('pessimistic_write').getOne();
      if (!request) throw new NotFoundException('CARD transfer request not found');
      if (request.status !== CardTransferStatus.HELD) throw new BadRequestException('Only held CARD transfers can be edited');
      if (request.destinationBranchId !== destination.id) throw new BadRequestException('Destination branch cannot be changed after the CARD transfer request is created');
      const oldSelections = await manager.getRepository(CardTransferRequestCard).find({ where: { transferId: id } });
      const oldIds = oldSelections.map(selection => selection.cardId);
      if (oldIds.length) {
        await manager.getRepository(CardStockCard).createQueryBuilder().update().set({ status: CardStockCardStatus.AVAILABLE, reservedByTransferId: null, reservedAt: null, updatedBy: session.userId }).where('reserved_by_transfer_id = :id', { id }).execute();
      }
      const cardsById = await this.loadLockedCards(manager, flatIds, source.id);
      const validated = [];
      let total = 0;
      for (const item of dto.items) { const result = await this.validateItem(item, cardsById); total += result.feAmount; validated.push({ item, ...result }); }
      await manager.getRepository(CardTransferRequestCard).delete({ transferId: id });
      await manager.getRepository(CardTransferRequestItem).delete({ transferId: id });
      request.transactionDate = policy.allowedDate;
      request.sourceBranchId = source.id;
      request.sourceBranchSnapshot = (sourceSnapshot ?? { id: source.id }) as TransactionReferenceSnapshot;
      request.destinationBranchId = destination.id;
      request.destinationBranchSnapshot = (destinationSnapshot ?? { id: destination.id }) as TransactionReferenceSnapshot;
      request.totalFeAmount = total.toFixed(2);
      request.remarks = dto.remarks?.trim() || null;
      request.updatedBy = session.userId;
      await manager.getRepository(CardTransferRequest).save(request);
      for (const row of validated) {
        const savedItem = await manager.getRepository(CardTransferRequestItem).save(manager.getRepository(CardTransferRequestItem).create({ transferId: id, lineNo: row.item.lineNo, currencyId: row.currency.id, currencySnapshot: await loadEntitySnapshot(this.currencyRepository, row.currency.id) ?? {}, per: row.item.per, productId: row.product.id, productSnapshot: await loadEntitySnapshot(this.productRepository, row.product.id) ?? {}, issuerPartyProfileId: row.issuer.id, issuerPartyProfileSnapshot: await loadEntitySnapshot(this.partyProfileRepository, row.issuer.id) ?? {}, feAmount: row.feAmount.toFixed(2), createdBy: session.userId, updatedBy: session.userId }));
        await manager.getRepository(CardTransferRequestCard).save(row.item.cardIds.map(cardId => manager.getRepository(CardTransferRequestCard).create({ transferId: id, transferItemId: savedItem.id, cardId, createdBy: session.userId, updatedBy: session.userId })));
      }
      for (const card of cardsById.values()) { card.status = CardStockCardStatus.RESERVED; card.reservedByTransferId = id; card.reservedAt = new Date(); card.updatedBy = session.userId; }
      await manager.getRepository(CardStockCard).save([...cardsById.values()]);
      return request;
    });
    return this.findById(saved.id, session);
  }

  async accept(id: string, session: AuthenticatedSession) {
    const request = await this.requestRepository.findOne({ where: { id }, relations: { items: { selectedCards: true } } });
    if (!request) throw new NotFoundException('CARD transfer request not found');
    if (request.status !== CardTransferStatus.HELD) throw new BadRequestException('Only held CARD transfers can be accepted');
    if (!this.isHoAccess(session) && session.activeBranchId !== request.destinationBranchId) throw new ForbiddenException('Only the destination branch or Admin/HO can accept this request');
    const [source, destination] = await Promise.all([
      this.branchRepository.findOne({ where: { id: request.sourceBranchId, isActive: true } }),
      this.branchRepository.findOne({ where: { id: request.destinationBranchId, isActive: true } }),
    ]);
    if (!source?.isHeadOffice) throw new BadRequestException('Source branch is no longer active');
    if (!destination) throw new BadRequestException('Destination branch is no longer active');
    await this.database2.transaction(async manager => {
      const locked = await manager.getRepository(CardTransferRequest).createQueryBuilder('request').where('request.id = :id', { id }).setLock('pessimistic_write').getOne();
      if (!locked || locked.status !== CardTransferStatus.HELD) throw new BadRequestException('CARD transfer has already been processed');
      const selections = await manager.getRepository(CardTransferRequestCard).find({ where: { transferId: id }, relations: ['card', 'card.receiptItem', 'transferItem'] });
      const cards = await this.loadLockedCards(manager, selections.map(selection => selection.cardId), request.sourceBranchId, id);
      const transactionItems = selections.map(selection => ({
        cardId: selection.cardId,
        currencyId: selection.card.receiptItem.currencyId,
        productId: selection.card.receiptItem.productId,
        quantity: 1,
        per: selection.transferItem.per,
        cardSnapshot: { id: selection.card.id, series: selection.card.series, kitNumber: selection.card.kitNumber, denomination: selection.card.denomination, amount: selection.card.amount, expirationDate: selection.card.expirationDate },
      }));
      for (const card of cards.values()) { card.currentBranchId = destination.id; card.currentBranchSnapshot = (await loadEntitySnapshot(this.branchRepository, destination.id) ?? { id: destination.id }) as TransactionReferenceSnapshot; card.status = CardStockCardStatus.AVAILABLE; card.reservedByTransferId = null; card.reservedAt = null; card.updatedBy = session.userId; }
      await manager.getRepository(CardStockCard).save([...cards.values()]);
      const transferOutTransaction = await this.cardStockTransactionService.create({ manager, operationCode: TransactionTypeProfileEnum.CARD_TRANSFER_OUT, branch: source, transactionDate: request.transactionDate, referenceType: CardStockReferenceType.CARD_TRANSFER_REQUEST, referenceId: request.id, actorId: session.userId, items: transactionItems });
      const transferInTransaction = await this.cardStockTransactionService.create({ manager, operationCode: TransactionTypeProfileEnum.CARD_TRANSFER_IN, branch: destination, transactionDate: request.transactionDate, referenceType: CardStockReferenceType.CARD_TRANSFER_REQUEST, referenceId: request.id, actorId: session.userId, items: transactionItems });
      locked.status = CardTransferStatus.ACCEPTED; locked.acceptedAt = new Date(); locked.acceptedById = session.userId; locked.acceptanceRemarks = null; locked.sourceTransactionId = transferOutTransaction.id; locked.destinationTransactionId = transferInTransaction.id; locked.updatedBy = session.userId; await manager.getRepository(CardTransferRequest).save(locked);
    });
    await this.notifyBranchUsers(request.sourceBranchId, `CARD transfer ${request.transactionNumber} accepted`, `CARD transfer request ${request.transactionNumber} was accepted by the destination branch.`);
    return this.findById(id, session);
  }

  async reject(id: string, remarks: string, session: AuthenticatedSession) { return this.finishHeld(id, CardTransferStatus.REJECTED, remarks, session); }
  async cancel(id: string, remarks: string, session: AuthenticatedSession) { this.assertHoAccess(session); return this.finishHeld(id, CardTransferStatus.CANCELLED, remarks, session); }

  private async finishHeld(id: string, status: typeof CardTransferStatus.REJECTED | typeof CardTransferStatus.CANCELLED, remarks: string, session: AuthenticatedSession) {
    if (!remarks?.trim()) throw new BadRequestException(`${status === CardTransferStatus.REJECTED ? 'Rejection' : 'Cancellation'} reason is required`);
    const current = await this.requestRepository.findOne({ where: { id } });
    if (!current) throw new NotFoundException('CARD transfer request not found');
    if (current.status !== CardTransferStatus.HELD) throw new BadRequestException('Only held CARD transfers can be changed');
    if (status === CardTransferStatus.REJECTED && !this.isHoAccess(session) && session.activeBranchId !== current.destinationBranchId) throw new ForbiddenException('Only the destination branch or Admin/HO can reject this request');
    await this.database2.transaction(async manager => {
      const request = await manager.getRepository(CardTransferRequest).createQueryBuilder('request').where('request.id = :id', { id }).setLock('pessimistic_write').getOne();
      if (!request || request.status !== CardTransferStatus.HELD) throw new BadRequestException('CARD transfer has already been processed');
      await this.cancelReservationsWithManager(manager, id, session.userId);
      request.status = status; request.updatedBy = session.userId;
      if (status === CardTransferStatus.REJECTED) { request.rejectedAt = new Date(); request.rejectedById = session.userId; request.rejectionReason = remarks.trim(); }
      else { request.cancelledAt = new Date(); request.cancelledById = session.userId; request.cancellationReason = remarks.trim(); }
      await manager.getRepository(CardTransferRequest).save(request);
    });
    await this.notifyBranchUsers(current.sourceBranchId, `CARD transfer ${current.transactionNumber} ${status.toLowerCase()}`, `CARD transfer request ${current.transactionNumber} was ${status.toLowerCase()}. Reason: ${remarks.trim()}`);
    if (status === CardTransferStatus.CANCELLED) {
      await this.notifyBranchUsers(current.destinationBranchId, `CARD transfer ${current.transactionNumber} cancelled`, `CARD transfer request ${current.transactionNumber} was cancelled. Reason: ${remarks.trim()}`);
    }
    return this.findById(id, session);
  }

  private async notifyBranchUsers(branchId: string, subject: string, text: string) {
    try {
      const userRoles = await this.userRoleRepository.createQueryBuilder('userRole')
        .leftJoinAndSelect('userRole.user', 'user')
        .leftJoin('userRole.branch', 'branch')
        .where('branch.id = :branchId', { branchId })
        .getMany();
      const recipients = Array.from(new Map(userRoles.map(role => role.user).filter((user): user is User => Boolean(user?.email)).map(user => [user.id, user])).values());
      for (const recipient of recipients) await this.mailService.sendEmail({ to: recipient.email, subject, text });
    } catch {
      // Notification delivery must not roll back a committed stock transfer.
    }
  }

  private async cancelReservationsWithManager(manager: import('typeorm').EntityManager, id: string, userId: string) { await manager.getRepository(CardStockCard).createQueryBuilder().update().set({ status: CardStockCardStatus.AVAILABLE, reservedByTransferId: null, reservedAt: null, updatedBy: userId }).where('reserved_by_transfer_id = :id', { id }).execute(); }

  private async withBranchObjects(requests: CardTransferRequest[]) {
    const ids = [...new Set(requests.flatMap(request => [request.sourceBranchId, request.destinationBranchId]))];
    const branches = await this.branchRepository.find({ where: { id: In(ids) } });
    const branchById = new Map(branches.map(branch => [branch.id, branch]));
    const cardIds = requests.flatMap(request => (request.items ?? []).flatMap(item => (item.selectedCards ?? []).map(selection => selection.cardId)));
    const decrypted = cardIds.length
      ? await this.database2.query('SELECT id, public.decrypt_card_number(card_number) AS "cardNumber" FROM card_stock_cards WHERE id = ANY($1::uuid[])', [cardIds])
      : [];
    const numberById = new Map(decrypted.map((row: { id: string; cardNumber: string }) => {
      const value = String(row.cardNumber ?? '');
      return [row.id, value.length > 8 ? `${value.slice(0, 4)}${'X'.repeat(value.length - 8)}${value.slice(-4)}` : value];
    }));
    return requests.map(request => ({
      ...request,
      sourceBranch: branchById.get(request.sourceBranchId) ?? null,
      destinationBranch: branchById.get(request.destinationBranchId) ?? null,
      items: (request.items ?? []).map(item => ({
        ...item,
        feAmount: item.feAmount,
        cards: (item.selectedCards ?? []).map(selection => ({
          id: selection.cardId,
          series: selection.card?.series ?? '',
          kitNumber: selection.card?.kitNumber ?? '',
          maskedCardNumber: numberById.get(selection.cardId) ?? null,
          currencyCode: item.currencySnapshot?.currencyCode ?? '',
          productCode: item.productSnapshot?.productCode ?? '',
          issuerName: item.issuerPartyProfileSnapshot?.name ?? '',
          denomination: selection.card?.denomination ?? '0.00',
          amount: selection.card?.amount ?? '0.00',
          expirationDate: selection.card?.expirationDate ?? '',
        })),
      })),
    }));
  }
}
