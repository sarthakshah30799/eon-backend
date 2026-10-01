import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { Transaction } from "../transactions/entities/transaction.entity";
import { TransactionItem } from "../transactions/entities/transaction-item.entity";
import { TransactionStatus } from "../transactions/transactions.enums";
import {
  isCardProductCode,
  isSurrenderUnitSnapshot,
  type ProductSnapshotLike,
} from "../card-stock/card-product.util";
import { CardStockSaleLifecycleService } from "../card-stock/card-stock-sale-lifecycle.service";
import { ProductSettlementService } from "./product-settlement.service";

@Injectable()
export class ProductSettlementWorker
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ProductSettlementWorker.name);
  private interval: NodeJS.Timeout | null = null;
  private running = false;
  constructor(
    @InjectDataSource("database2") private readonly database2: DataSource,
    private readonly saleLifecycleService: CardStockSaleLifecycleService,
    private readonly settlementService: ProductSettlementService,
  ) {}
  onModuleInit() {
    void this.run();
    this.interval = setInterval(() => void this.run(), 30_000);
  }
  onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
  }
  private async run() {
    if (this.running) return;
    this.running = true;
    try {
      await this.reconcileApprovedSales();
      await this.settlementService.reconcile();
    } catch (error) {
      this.logger.error(
        "CARD settlement reconciliation failed",
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }

  private isBlankStockCardItem(item: TransactionItem): boolean {
    if (!item.cardId) return false;
    const snapshot = item.productSnapshot as ProductSnapshotLike | null;
    if (isSurrenderUnitSnapshot(snapshot)) return false;
    const code =
      snapshot?.productCode ?? snapshot?.product_code ?? snapshot?.code ?? null;
    return isCardProductCode(code);
  }

  private async reconcileApprovedSales() {
    // Blank-stock CC/CM only. Surrender EM/etc. issuer sales also have card_id
    // but use finalizeEmIssuerSale (no LOAD / product_settlements) — do not
    // re-run blank-stock finalizeApprovedSale against CM receipt parents.
    const rows: Array<{ transaction_id: string }> = await this.database2.query(`
      SELECT t.id AS transaction_id
      FROM transactions t
      JOIN transaction_items i ON i.transaction_id=t.id AND i.card_id IS NOT NULL
      WHERE t.status='APPROVED' AND t.transaction_type='SALE'
        AND UPPER(COALESCE(
          i.product_snapshot->>'productCode',
          i.product_snapshot->>'product_code',
          i.product_snapshot->>'code',
          ''
        )) IN ('CC', 'CM')
        AND COALESCE((i.product_snapshot->>'maintainBlankStockOfProduct')::boolean, true) = true
        AND (
          NOT EXISTS (SELECT 1 FROM card_stock_transaction_entries e WHERE e.card_id=i.card_id AND e.reference_id=t.id AND e.currency_id=i.currency_id AND e.operation_type='CARD_STOCK_LOAD')
          OR NOT EXISTS (SELECT 1 FROM card_stock_transaction_entries e WHERE e.card_id=i.card_id AND e.reference_id=t.id AND e.currency_id=i.currency_id AND e.operation_type='SELL')
          OR NOT EXISTS (SELECT 1 FROM product_settlements s WHERE s.transaction_item_id=i.id)
          OR EXISTS (SELECT 1 FROM product_settlements s WHERE s.transaction_item_id=i.id AND s.branch_settlement_entry_id IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM card_stock_balance balance WHERE balance.card_id=i.card_id AND balance.branch_id=t.branch_id AND balance.series=s.series AND balance.settle_entry_id=s.branch_settlement_entry_id
          ))
        )
      GROUP BY t.id, t.created_at ORDER BY t.created_at LIMIT 50`);
    for (const row of rows) {
      try {
        await this.database2.transaction(async (manager) => {
          const transaction = await manager
            .getRepository(Transaction)
            .createQueryBuilder("transaction")
            .where("transaction.id=:id AND transaction.status=:status", {
              id: row.transaction_id,
              status: TransactionStatus.APPROVED,
            })
            .setLock("pessimistic_write")
            .getOne();
          if (!transaction) return;
          const items = await manager
            .getRepository(TransactionItem)
            .find({ where: { transactionId: transaction.id } });
          const blankStockCardItems = items.filter((item) =>
            this.isBlankStockCardItem(item),
          );
          if (!blankStockCardItems.length) return;
          await this.saleLifecycleService.finalizeApprovedSale(
            manager,
            transaction,
            blankStockCardItems,
            transaction.approvedById ?? transaction.updatedBy,
          );
        });
      } catch (error) {
        this.logger.error(
          `Failed to reconcile CARD sale ${row.transaction_id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    const ttRows: Array<{ transaction_id: string }> = await this.database2
      .query(`
      SELECT t.id AS transaction_id
      FROM transactions t
      JOIN transaction_items i ON i.transaction_id=t.id AND i.deal_cover_id IS NOT NULL
      WHERE t.status='APPROVED'
        AND NOT EXISTS (
          SELECT 1 FROM product_settlements s
          WHERE s.transaction_item_id=i.id AND s.type='TT' AND s.deleted_at IS NULL
        )
      GROUP BY t.id, t.created_at ORDER BY t.created_at LIMIT 50`);
    for (const row of ttRows) {
      try {
        await this.database2.transaction(async (manager) => {
          const transaction = await manager
            .getRepository(Transaction)
            .createQueryBuilder("transaction")
            .where("transaction.id=:id AND transaction.status=:status", {
              id: row.transaction_id,
              status: TransactionStatus.APPROVED,
            })
            .setLock("pessimistic_write")
            .getOne();
          if (!transaction) return;
          const items = await manager
            .getRepository(TransactionItem)
            .find({ where: { transactionId: transaction.id } });
          const ttItems = items.filter((item) => Boolean(item.dealCoverId));
          await this.settlementService.createForApprovedTtItems(
            manager,
            transaction,
            ttItems,
            transaction.approvedById ?? transaction.updatedBy,
          );
        });
      } catch (error) {
        this.logger.error(
          `Failed to reconcile TT sale ${row.transaction_id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }
}
