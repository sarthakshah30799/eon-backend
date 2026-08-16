import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransactionItem } from '../transactions/entities/transaction-item.entity';
import { TransactionStatus } from '../transactions/transactions.enums';
import { CardStockSaleLifecycleService } from './card-stock-sale-lifecycle.service';
import { CardStockSettlementService } from './card-stock-settlement.service';

@Injectable()
export class CardStockSettlementWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CardStockSettlementWorker.name);
  private interval: NodeJS.Timeout | null = null;
  private running = false;
  constructor(
    @InjectDataSource('database2') private readonly database2: DataSource,
    private readonly saleLifecycleService: CardStockSaleLifecycleService,
    private readonly settlementService: CardStockSettlementService,
  ) {}
  onModuleInit() { void this.run(); this.interval = setInterval(() => void this.run(), 30_000); }
  onModuleDestroy() { if (this.interval) clearInterval(this.interval); }
  private async run() {
    if (this.running) return;
    this.running = true;
    try {
      await this.reconcileApprovedSales();
      await this.settlementService.reconcile();
    }
    catch (error) { this.logger.error('CARD settlement reconciliation failed', error instanceof Error ? error.stack : String(error)); }
    finally { this.running = false; }
  }

  private async reconcileApprovedSales() {
    const rows: Array<{ transaction_id: string }> = await this.database2.query(`
      SELECT t.id AS transaction_id
      FROM transactions t
      JOIN transaction_items i ON i.transaction_id=t.id AND i.card_id IS NOT NULL
      WHERE t.status='APPROVED' AND t.transaction_type='SALE'
        AND (
          NOT EXISTS (SELECT 1 FROM card_stock_transaction_entries e WHERE e.card_id=i.card_id AND e.reference_id=t.id AND e.operation_type='CARD_STOCK_LOAD')
          OR NOT EXISTS (SELECT 1 FROM card_stock_transaction_entries e WHERE e.card_id=i.card_id AND e.reference_id=t.id AND e.operation_type='SELL')
          OR NOT EXISTS (SELECT 1 FROM card_stock_settlements s WHERE s.transaction_item_id=i.id)
          OR EXISTS (SELECT 1 FROM card_stock_settlements s WHERE s.transaction_item_id=i.id AND s.branch_settlement_entry_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM card_stock_balance balance WHERE balance.card_id=i.card_id AND balance.branch_id=t.branch_id AND balance.series=s.series AND balance.settle_entry_id=s.branch_settlement_entry_id
          ))
        )
      GROUP BY t.id, t.created_at ORDER BY t.created_at LIMIT 50`);
    for (const row of rows) {
      try {
        await this.database2.transaction(async manager => {
          const transaction = await manager.getRepository(Transaction).createQueryBuilder('transaction')
            .where('transaction.id=:id AND transaction.status=:status', { id: row.transaction_id, status: TransactionStatus.APPROVED })
            .setLock('pessimistic_write')
            .getOne();
          if (!transaction) return;
          const items = await manager.getRepository(TransactionItem).find({ where: { transactionId: transaction.id } });
          await this.saleLifecycleService.finalizeApprovedSale(manager, transaction, items.filter(item => Boolean(item.cardId)), transaction.approvedById ?? transaction.updatedBy);
        });
      } catch (error) {
        this.logger.error(`Failed to reconcile CARD sale ${row.transaction_id}`, error instanceof Error ? error.stack : String(error));
      }
    }
  }
}
