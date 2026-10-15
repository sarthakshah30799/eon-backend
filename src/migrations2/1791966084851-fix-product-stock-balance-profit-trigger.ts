import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * The card→product rename rewrote `card_stock_balance` inside
 * `card_stock_balance_recalculate_sale_profit`, which CREATE OR REPLACE'd a
 * new function `product_stock_balance_recalculate_sale_profit` while leaving
 * triggers bound to the old (stale) function that still references
 * `card_stock_transaction_entries`.
 */
export class FixProductStockBalanceProfitTrigger1791966084851
  implements MigrationInterface
{
  name = "FixProductStockBalanceProfitTrigger1791966084851";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regprocedure('public.product_stock_balance_recalculate_sale_profit()') IS NULL THEN
          RAISE EXCEPTION 'product_stock_balance_recalculate_sale_profit() not found';
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS card_stock_balance_recalculate_sale_profit_insert
        ON public.product_stock_balance;
      CREATE TRIGGER card_stock_balance_recalculate_sale_profit_insert
      AFTER INSERT ON public.product_stock_balance
      FOR EACH ROW
      EXECUTE FUNCTION public.product_stock_balance_recalculate_sale_profit();
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS card_stock_balance_recalculate_sale_profit_update
        ON public.product_stock_balance;
      CREATE TRIGGER card_stock_balance_recalculate_sale_profit_update
      AFTER UPDATE OF settle_entry_id, settle_rate, settle_amount
        ON public.product_stock_balance
      FOR EACH ROW
      WHEN (
        OLD.settle_entry_id IS DISTINCT FROM NEW.settle_entry_id
        OR OLD.settle_rate IS DISTINCT FROM NEW.settle_rate
        OR OLD.settle_amount IS DISTINCT FROM NEW.settle_amount
      )
      EXECUTE FUNCTION public.product_stock_balance_recalculate_sale_profit();
    `);

    await queryRunner.query(`
      DROP FUNCTION IF EXISTS public.card_stock_balance_recalculate_sale_profit();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.card_stock_balance_recalculate_sale_profit()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      DECLARE
        settlement_id uuid;
        sale_transaction_id uuid;
        sale_transaction_item_id uuid;
        settlement_transaction_id uuid;
        actor_id uuid;
      BEGIN
        IF NEW.settle_entry_id IS NULL THEN
          RETURN NEW;
        END IF;

        SELECT entry.reference_id, entry.transaction_id
          INTO settlement_id, settlement_transaction_id
        FROM product_stock_transaction_entries entry
        WHERE entry.id = NEW.settle_entry_id
          AND entry.operation_type = 'SETTLE'
          AND entry.reference_type = 'CARD_BRANCH_SETTLEMENT';

        IF settlement_id IS NULL THEN
          RETURN NEW;
        END IF;

        SELECT settlement.transaction_id, settlement.transaction_item_id
          INTO sale_transaction_id, sale_transaction_item_id
        FROM product_settlements settlement
        WHERE settlement.id = settlement_id;

        IF sale_transaction_id IS NULL OR sale_transaction_item_id IS NULL THEN
          RETURN NEW;
        END IF;

        actor_id := COALESCE(NEW.updated_by, NEW.created_by);

        UPDATE transaction_items
        SET updated_at = now(), updated_by = actor_id
        WHERE id = sale_transaction_item_id;

        DELETE FROM transaction_events
        WHERE transaction_id IN (sale_transaction_id, settlement_transaction_id)
          AND event_type = 'ACCOUNT_POSTINGS_REBUILD'
          AND status IN ('PENDING', 'PROCESSING');

        INSERT INTO transaction_events (
          id, created_at, updated_at, created_by, updated_by,
          transaction_id, event_type, payload, status, attempt_count,
          available_at, processed_at, error_message, locked_at, locked_by_id
        )
        SELECT
          uuid_generate_v4(), now(), now(), actor_id, actor_id,
          target.transaction_id, 'ACCOUNT_POSTINGS_REBUILD',
          jsonb_build_object(
            'transactionId', target.transaction_id,
            'tableName', 'product_stock_balance',
            'operation', TG_OP
          ),
          'PENDING', 0, now(), NULL, NULL, NULL, NULL
        FROM (
          SELECT sale_transaction_id AS transaction_id
          UNION
          SELECT settlement_transaction_id AS transaction_id
        ) target
        WHERE target.transaction_id IS NOT NULL;

        RETURN NEW;
      END;
      $$;
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS card_stock_balance_recalculate_sale_profit_insert
        ON public.product_stock_balance;
      CREATE TRIGGER card_stock_balance_recalculate_sale_profit_insert
      AFTER INSERT ON public.product_stock_balance
      FOR EACH ROW
      EXECUTE FUNCTION public.card_stock_balance_recalculate_sale_profit();
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS card_stock_balance_recalculate_sale_profit_update
        ON public.product_stock_balance;
      CREATE TRIGGER card_stock_balance_recalculate_sale_profit_update
      AFTER UPDATE OF settle_entry_id, settle_rate, settle_amount
        ON public.product_stock_balance
      FOR EACH ROW
      WHEN (
        OLD.settle_entry_id IS DISTINCT FROM NEW.settle_entry_id
        OR OLD.settle_rate IS DISTINCT FROM NEW.settle_rate
        OR OLD.settle_amount IS DISTINCT FROM NEW.settle_amount
      )
      EXECUTE FUNCTION public.card_stock_balance_recalculate_sale_profit();
    `);

    await queryRunner.query(`
      DROP FUNCTION IF EXISTS public.product_stock_balance_recalculate_sale_profit();
    `);
  }
}
