import { MigrationInterface, QueryRunner } from "typeorm";

export class CardSettlementAccountPosting1786723816973 implements MigrationInterface {
  name = "CardSettlementAccountPosting1786723816973";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transaction_items" ADD "profit_amount" numeric(18,2)`,
    );
    await queryRunner.query(`
            DO $$
            DECLARE
              function_definition text;
            BEGIN
              function_definition := pg_get_functiondef(
                'public.card_stock_on_card_insert()'::regprocedure
              );

              IF function_definition LIKE '%receipt.ho_branch_id%'
                OR function_definition LIKE '%receipt.ho_branch_snapshot%' THEN
                function_definition := replace(
                  replace(
                    function_definition,
                    'receipt.ho_branch_id',
                    'receipt.branch_id'
                  ),
                  'receipt.ho_branch_snapshot',
                  'receipt.branch_snapshot'
                );
                EXECUTE function_definition;
              END IF;
            END;
            $$;
        `);
    await queryRunner.query(`
            DO $$
            DECLARE
              function_definition text;
            BEGIN
              function_definition := pg_get_functiondef(
                'public.card_stock_on_transaction_item()'::regprocedure
              );

              IF function_definition NOT LIKE
                '%coalesce(NEW.card_stock_reference_type,t.card_stock_reference_type)%' THEN
                function_definition := replace(
                  function_definition,
                  't.card_stock_reference_type',
                  'coalesce(NEW.card_stock_reference_type,t.card_stock_reference_type)'
                );
              END IF;

              IF function_definition NOT LIKE
                '%coalesce(NEW.card_stock_reference_id,t.card_stock_reference_id)%' THEN
                function_definition := replace(
                  function_definition,
                  't.card_stock_reference_id',
                  'coalesce(NEW.card_stock_reference_id,t.card_stock_reference_id)'
                );
              END IF;

              EXECUTE function_definition;
            END;
            $$;
        `);
    await queryRunner.query(`
            CREATE OR REPLACE FUNCTION public.transaction_items_hold_profit_trigger()
            RETURNS trigger
            LANGUAGE plpgsql
            AS $$
            DECLARE
              transaction_type text;
              transaction_status text;
              purchase_qty numeric(18,7);
              purchase_amount numeric(18,7);
              hold_cost_value numeric(18,7);
              card_settle_rate numeric(18,7);
              card_settle_amount numeric(18,2);
              card_sale_amount numeric(18,2);
            BEGIN
              SELECT t.transaction_type, t.status
                INTO transaction_type, transaction_status
              FROM transactions t
              WHERE t.id = NEW.transaction_id;

              IF transaction_status IS DISTINCT FROM 'APPROVED' THEN
                NEW.hold_cost := NULL;
                NEW.profit := NULL;
                NEW.profit_amount := NULL;
                RETURN NEW;
              END IF;

              IF NEW.card_id IS NOT NULL THEN
                IF transaction_type IS DISTINCT FROM 'SALE' THEN
                  NEW.hold_cost := NULL;
                  NEW.profit := NULL;
                  NEW.profit_amount := NULL;
                  RETURN NEW;
                END IF;

                SELECT balance.settle_rate, balance.settle_amount
                  INTO card_settle_rate, card_settle_amount
                FROM card_stock_balance balance
                INNER JOIN card_stock_transaction_entries settle_entry
                  ON settle_entry.id = balance.settle_entry_id
                 AND settle_entry.operation_type = 'SETTLE'
                 AND settle_entry.reference_type = 'CARD_BRANCH_SETTLEMENT'
                INNER JOIN card_stock_settlements settlement
                  ON settlement.id = settle_entry.reference_id
                 AND settlement.card_id = balance.card_id
                 AND settlement.branch_id = balance.branch_id
                 AND settlement.series = balance.series
                WHERE settlement.transaction_item_id = NEW.id
                ORDER BY balance.settle_date DESC NULLS LAST, balance.created_at DESC
                LIMIT 1;

                IF card_settle_amount IS NULL THEN
                  NEW.hold_cost := NULL;
                  NEW.profit := NULL;
                  NEW.profit_amount := NULL;
                  RETURN NEW;
                END IF;

                card_sale_amount := ROUND(
                  (COALESCE(NEW.quantity, 0) * COALESCE(NEW.rate, 0)
                    / COALESCE(NULLIF(NEW.per, 0), 1))
                  + COALESCE(NEW.round_off, 0),
                  2
                );
                NEW.hold_cost := card_settle_rate;
                NEW.profit := NULL;
                NEW.profit_amount := ROUND(card_sale_amount - card_settle_amount, 2);
                RETURN NEW;
              END IF;

              NEW.profit_amount := NULL;

              SELECT
                COALESCE(SUM(ti.quantity), 0),
                COALESCE(SUM(ti.quantity * ti.rate), 0)
              INTO purchase_qty, purchase_amount
              FROM transaction_items ti
              INNER JOIN transactions pt ON pt.id = ti.transaction_id
              WHERE pt.status = 'APPROVED'
                AND pt.transaction_type = 'PURCHASE'
                AND ti.product_id = NEW.product_id
                AND ti.currency_id = NEW.currency_id
                AND ti.id IS DISTINCT FROM NEW.id;

              IF transaction_type = 'PURCHASE' THEN
                purchase_qty := purchase_qty + COALESCE(NEW.quantity, 0);
                purchase_amount := purchase_amount
                  + (COALESCE(NEW.quantity, 0) * COALESCE(NEW.rate, 0));
              END IF;

              IF purchase_qty > 0 THEN
                hold_cost_value := ROUND(purchase_amount / purchase_qty, 7);
              ELSE
                hold_cost_value := NULL;
              END IF;

              NEW.hold_cost := hold_cost_value;

              IF transaction_type = 'SALE' THEN
                IF hold_cost_value IS NULL THEN
                  NEW.profit := NULL;
                ELSE
                  NEW.profit := ROUND(COALESCE(NEW.rate, 0) - hold_cost_value, 2);
                END IF;
              ELSE
                NEW.profit := NULL;
              END IF;

              RETURN NEW;
            END;
            $$;
        `);
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
              FROM card_stock_transaction_entries entry
              WHERE entry.id = NEW.settle_entry_id
                AND entry.operation_type = 'SETTLE'
                AND entry.reference_type = 'CARD_BRANCH_SETTLEMENT';

              IF settlement_id IS NULL THEN
                RETURN NEW;
              END IF;

              SELECT settlement.transaction_id, settlement.transaction_item_id
                INTO sale_transaction_id, sale_transaction_item_id
              FROM card_stock_settlements settlement
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
                  'tableName', 'card_stock_balance',
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
              ON "card_stock_balance";
            CREATE TRIGGER card_stock_balance_recalculate_sale_profit_insert
            AFTER INSERT ON "card_stock_balance"
            FOR EACH ROW
            EXECUTE FUNCTION public.card_stock_balance_recalculate_sale_profit();
        `);
    await queryRunner.query(`
            DROP TRIGGER IF EXISTS card_stock_balance_recalculate_sale_profit_update
              ON "card_stock_balance";
            CREATE TRIGGER card_stock_balance_recalculate_sale_profit_update
            AFTER UPDATE OF settle_entry_id, settle_rate, settle_amount
              ON "card_stock_balance"
            FOR EACH ROW
            WHEN (
              OLD.settle_entry_id IS DISTINCT FROM NEW.settle_entry_id
              OR OLD.settle_rate IS DISTINCT FROM NEW.settle_rate
              OR OLD.settle_amount IS DISTINCT FROM NEW.settle_amount
            )
            EXECUTE FUNCTION public.card_stock_balance_recalculate_sale_profit();
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP TRIGGER IF EXISTS card_stock_balance_recalculate_sale_profit_update
              ON "card_stock_balance";
        `);
    await queryRunner.query(`
            DROP TRIGGER IF EXISTS card_stock_balance_recalculate_sale_profit_insert
              ON "card_stock_balance";
        `);
    await queryRunner.query(`
            DROP FUNCTION IF EXISTS public.card_stock_balance_recalculate_sale_profit();
        `);
    await queryRunner.query(`
            DO $$
            DECLARE
              function_definition text;
            BEGIN
              function_definition := pg_get_functiondef(
                'public.card_stock_on_transaction_item()'::regprocedure
              );
              function_definition := replace(
                function_definition,
                'coalesce(NEW.card_stock_reference_type,t.card_stock_reference_type)',
                't.card_stock_reference_type'
              );
              function_definition := replace(
                function_definition,
                'coalesce(NEW.card_stock_reference_id,t.card_stock_reference_id)',
                't.card_stock_reference_id'
              );
              EXECUTE function_definition;
            END;
            $$;
        `);
    await queryRunner.query(`
            CREATE OR REPLACE FUNCTION public.transaction_items_hold_profit_trigger()
            RETURNS trigger
            LANGUAGE plpgsql
            AS $$
            DECLARE
              transaction_type text;
              transaction_status text;
              purchase_qty numeric(18,7);
              purchase_amount numeric(18,7);
              hold_cost_value numeric(18,7);
            BEGIN
              SELECT t.transaction_type, t.status
                INTO transaction_type, transaction_status
              FROM transactions t
              WHERE t.id = NEW.transaction_id;

              IF transaction_status IS DISTINCT FROM 'APPROVED' THEN
                NEW.hold_cost := NULL;
                NEW.profit := NULL;
                RETURN NEW;
              END IF;

              SELECT
                COALESCE(SUM(ti.quantity), 0),
                COALESCE(SUM(ti.quantity * ti.rate), 0)
              INTO purchase_qty, purchase_amount
              FROM transaction_items ti
              INNER JOIN transactions pt ON pt.id = ti.transaction_id
              WHERE pt.status = 'APPROVED'
                AND pt.transaction_type = 'PURCHASE'
                AND ti.product_id = NEW.product_id
                AND ti.currency_id = NEW.currency_id
                AND ti.id IS DISTINCT FROM NEW.id;

              IF transaction_type = 'PURCHASE' THEN
                purchase_qty := purchase_qty + COALESCE(NEW.quantity, 0);
                purchase_amount := purchase_amount
                  + (COALESCE(NEW.quantity, 0) * COALESCE(NEW.rate, 0));
              END IF;

              IF purchase_qty > 0 THEN
                hold_cost_value := ROUND(purchase_amount / purchase_qty, 7);
              ELSE
                hold_cost_value := NULL;
              END IF;

              NEW.hold_cost := hold_cost_value;

              IF transaction_type = 'SALE' THEN
                IF hold_cost_value IS NULL THEN
                  NEW.profit := NULL;
                ELSE
                  NEW.profit := ROUND(COALESCE(NEW.rate, 0) - hold_cost_value, 2);
                END IF;
              ELSE
                NEW.profit := NULL;
              END IF;

              RETURN NEW;
            END;
            $$;
        `);
    await queryRunner.query(
      `ALTER TABLE "transaction_items" DROP COLUMN "profit_amount"`,
    );
  }
}
