import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { Branch } from '../branches/branch.entity';
import { ProductCardIssuer } from '../products/entities/product-card-issuer.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransactionItem } from '../transactions/entities/transaction-item.entity';
import { TransactionStatus, TransactionType, TransactionTypeProfileEnum } from '../transactions/transactions.enums';
import { CardStockCardStatus, CardStockReferenceType } from './card-stock.enums';
import { CardStockTechnicalTransactionService } from './card-stock-technical-transaction.service';
import { CardStockSettlementService } from './card-stock-settlement.service';
import { CardStockCard } from './entities/card-stock-card.entity';

@Injectable()
export class CardStockSaleLifecycleService {
  constructor(
    @InjectRepository(Branch) private readonly branchRepository: Repository<Branch>,
    @InjectRepository(ProductCardIssuer) private readonly productIssuerRepository: Repository<ProductCardIssuer>,
    private readonly technicalTransactionService: CardStockTechnicalTransactionService,
    private readonly settlementService: CardStockSettlementService,
  ) {}

  async finalizeApprovedSale(manager: EntityManager, transaction: Transaction, items: TransactionItem[], actorId: string) {
    if (transaction.status !== TransactionStatus.APPROVED || transaction.transactionType !== TransactionType.SALE) {
      throw new BadRequestException('CARD lifecycle requires an approved sale transaction');
    }
    const cardItems = items.filter(item => Boolean(item.cardId));
    if (!cardItems.length) return;
    if (new Set(cardItems.map(item => item.cardId)).size !== cardItems.length) {
      throw new BadRequestException('A CARD can be selected only once in one transaction');
    }

    const existingSettlementRows: Array<{ transaction_item_id: string }> = await manager.query(
      `SELECT transaction_item_id FROM card_stock_settlements WHERE transaction_item_id = ANY($1::uuid[])`,
      [cardItems.map(item => item.id)],
    );
    const settledItemIds = new Set(existingSettlementRows.map(row => row.transaction_item_id));
    await this.settlementService.assertPersistedBuyRates(cardItems.filter(item => !settledItemIds.has(item.id)));
    const cardIds = cardItems.map(item => String(item.cardId)).sort();
    const cards = await manager.getRepository(CardStockCard).createQueryBuilder('card')
      .innerJoinAndSelect('card.receiptItem', 'receiptItem')
      .where({ id: In(cardIds) })
      .orderBy('card.id', 'ASC')
      .setLock('pessimistic_write')
      .getMany();
    if (cards.length !== cardIds.length) throw new NotFoundException('One or more selected CARDs no longer exist');
    const cardById = new Map(cards.map(card => [card.id, card]));
    const branch = await this.branchRepository.findOne({ where: { id: transaction.branchId, isActive: true } });
    if (!branch) throw new NotFoundException(`Branch ${transaction.branchId} not found for CARD sale`);

    for (const item of [...cardItems].sort((left, right) => String(left.cardId).localeCompare(String(right.cardId)))) {
      const card = cardById.get(String(item.cardId));
      if (!card?.receiptItem || !item.issuerPartyProfileId) throw new BadRequestException(`CARD item ${item.lineNo} is incomplete`);
      if (card.currentBranchId !== transaction.branchId) throw new BadRequestException(`CARD item ${item.lineNo} is not held by the sale branch`);
      if (card.reservedByTransferId || card.reservedAt) throw new BadRequestException(`CARD item ${item.lineNo} is reserved for transfer`);
      if (card.receiptItem.currencyId !== item.currencyId || card.receiptItem.productId !== item.productId || card.receiptItem.issuerPartyProfileId !== item.issuerPartyProfileId) {
        throw new BadRequestException(`CARD item ${item.lineNo} does not match its currency, product, or issuer`);
      }
      const issuerLink = await this.productIssuerRepository.findOne({ where: { productId: item.productId, partyProfileId: item.issuerPartyProfileId } });
      if (!issuerLink) throw new BadRequestException(`Issuer is not linked to the CARD product for item ${item.lineNo}`);

      const existingLoad: Array<{ id: string }> = await manager.query(
        `SELECT id FROM card_stock_transaction_entries WHERE card_id=$1 AND operation_type='CARD_STOCK_LOAD' AND reference_type='CARD_SALE' AND reference_id=$2 LIMIT 1`,
        [card.id, transaction.id],
      );
      if (!existingLoad[0]) {
        if (!item.isReload && card.status !== CardStockCardStatus.AVAILABLE) {
          throw new BadRequestException(`CARD item ${item.lineNo} is not available for sale`);
        }
        if (item.isReload && card.status !== CardStockCardStatus.SOLD) {
          throw new BadRequestException(`CARD item ${item.lineNo} is not eligible for reload`);
        }
        if (item.isReload) await this.assertReloadPassenger(manager, transaction, item);
        await this.technicalTransactionService.create({
          manager,
          operationCode: TransactionTypeProfileEnum.CARD_STOCK_LOAD,
          branch,
          transactionDate: transaction.transactionDate ?? new Date(),
          referenceType: CardStockReferenceType.CARD_SALE,
          referenceId: transaction.id,
          actorId,
          items: [{
            cardId: card.id,
            currencyId: item.currencyId,
            productId: item.productId,
            quantity: item.quantity,
            per: item.per ?? '1',
            cardSnapshot: item.cardSnapshot ?? { id: card.id, series: card.series, kitNumber: card.kitNumber, denomination: card.denomination, amount: card.amount, expirationDate: card.expirationDate },
          }],
        });
      }

      const existingSell: Array<{ id: string }> = await manager.query(
        `SELECT id FROM card_stock_transaction_entries WHERE card_id=$1 AND operation_type='SELL' AND reference_type='CARD_SALE' AND reference_id=$2 LIMIT 1`,
        [card.id, transaction.id],
      );
      if (!existingSell[0]) {
        await manager.query(`UPDATE transaction_items SET updated_at=now(), updated_by=$2 WHERE id=$1`, [item.id, actorId]);
        const createdSell: Array<{ id: string }> = await manager.query(
          `SELECT id FROM card_stock_transaction_entries WHERE card_id=$1 AND operation_type='SELL' AND reference_type='CARD_SALE' AND reference_id=$2 LIMIT 1`,
          [card.id, transaction.id],
        );
        if (!createdSell[0]) throw new BadRequestException(`SELL ledger entry was not created for CARD item ${item.lineNo}`);
      }
    }
    await this.settlementService.createForApprovedSale(manager, transaction, cardItems, actorId);
  }

  private async assertReloadPassenger(manager: EntityManager, transaction: Transaction, item: TransactionItem) {
    if (!transaction.passengerId) throw new BadRequestException('CARD reload requires an existing matched passenger');
    const rows: Array<{ id: string }> = await manager.query(
      `SELECT ti.id FROM transaction_items ti JOIN transactions t ON t.id=ti.transaction_id
       JOIN card_stock_settlements settlement ON settlement.transaction_item_id=ti.id AND settlement.branch_settlement_entry_id IS NOT NULL
       WHERE ti.card_id=$1 AND t.passenger_id=$2 AND t.transaction_type='SALE' AND t.status='APPROVED' AND t.id<>$3 LIMIT 1`,
      [item.cardId, transaction.passengerId, transaction.id],
    );
    if (!rows[0]) throw new BadRequestException(`CARD item ${item.lineNo} was not previously sold to this passenger`);
  }
}
