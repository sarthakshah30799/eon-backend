import { MigrationInterface, QueryRunner } from "typeorm";

export class CardSaleProfitFromItemSettlement1787041588900 implements MigrationInterface {
  name = "CardSaleProfitFromItemSettlement1787041588900";

  public async up(queryRunner: QueryRunner): Promise<void> {
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
        item_raw_amount numeric(18,2);
      BEGIN
        item_raw_amount := ROUND(
          COALESCE(NEW.quantity, 0) * COALESCE(NEW.rate, 0)
            / COALESCE(NULLIF(NEW.per, 0), 1),
          2
        );
        NEW.amount := ROUND(item_raw_amount, 0);
        NEW.round_off := ROUND(NEW.amount - item_raw_amount, 2);

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

          SELECT settlement.buy_rate, settlement.settlement_amount
            INTO card_settle_rate, card_settle_amount
          FROM card_stock_settlements settlement
          WHERE settlement.transaction_item_id = NEW.id
            AND settlement.deleted_at IS NULL
            AND settlement.status IS DISTINCT FROM 'CANCELLED'
            AND settlement.branch_settlement_entry_id IS NOT NULL
          ORDER BY settlement.branch_settlement_date DESC NULLS LAST, settlement.created_at DESC
          LIMIT 1;

          IF card_settle_amount IS NULL THEN
            NEW.hold_cost := NULL;
            NEW.profit := NULL;
            NEW.profit_amount := NULL;
            RETURN NEW;
          END IF;

          NEW.hold_cost := card_settle_rate;
          NEW.profit := NULL;
          NEW.profit_amount := ROUND(NEW.amount - card_settle_amount, 2);
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
      DO $$
      BEGIN
        ALTER TABLE transaction_items DISABLE TRIGGER USER;

        UPDATE transaction_items ti
        SET
          hold_cost = settlement.buy_rate,
          profit = NULL,
          profit_amount = ROUND(ti.amount - settlement.settlement_amount, 2)
        FROM card_stock_settlements settlement
        WHERE settlement.transaction_item_id = ti.id
          AND ti.card_id IS NOT NULL
          AND ti.deleted_at IS NULL
          AND settlement.deleted_at IS NULL
          AND settlement.status IS DISTINCT FROM 'CANCELLED'
          AND settlement.branch_settlement_entry_id IS NOT NULL;

        ALTER TABLE transaction_items ENABLE TRIGGER USER;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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
        item_raw_amount numeric(18,2);
      BEGIN
        item_raw_amount := ROUND(
          COALESCE(NEW.quantity, 0) * COALESCE(NEW.rate, 0)
            / COALESCE(NULLIF(NEW.per, 0), 1),
          2
        );
        NEW.amount := ROUND(item_raw_amount, 0);
        NEW.round_off := ROUND(NEW.amount - item_raw_amount, 2);

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

          NEW.hold_cost := card_settle_rate;
          NEW.profit := NULL;
          NEW.profit_amount := ROUND(NEW.amount - card_settle_amount, 2);
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
  }
}
