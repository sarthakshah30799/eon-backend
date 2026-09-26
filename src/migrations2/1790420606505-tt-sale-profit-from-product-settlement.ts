import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * TT sale lines never received profit_amount: the hold/profit trigger only
 * computed CARD settlements (card_id + branch_settlement_entry_id) and always
 * nulled profit_amount for every other item, including deal_cover TT.
 * Product-profit report gates TT on profit_amount after branch settle.
 */
export class TtSaleProfitFromProductSettlement1790420606505
  implements MigrationInterface
{
  name = "TtSaleProfitFromProductSettlement1790420606505";

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
        settle_rate numeric(18,7);
        settle_amount numeric(18,2);
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
            INTO settle_rate, settle_amount
          FROM product_settlements settlement
          WHERE settlement.transaction_item_id = NEW.id
            AND settlement.deleted_at IS NULL
            AND settlement.status IS DISTINCT FROM 'CANCELLED'
            AND settlement.branch_settlement_entry_id IS NOT NULL
          ORDER BY settlement.branch_settlement_date DESC NULLS LAST,
                   settlement.created_at DESC
          LIMIT 1;

          IF settle_amount IS NULL THEN
            NEW.hold_cost := NULL;
            NEW.profit := NULL;
            NEW.profit_amount := NULL;
            RETURN NEW;
          END IF;

          NEW.hold_cost := settle_rate;
          NEW.profit := NULL;
          NEW.profit_amount := ROUND(NEW.amount - settle_amount, 2);
          RETURN NEW;
        END IF;

        IF NEW.deal_cover_id IS NOT NULL THEN
          IF transaction_type IS DISTINCT FROM 'SALE' THEN
            NEW.hold_cost := NULL;
            NEW.profit := NULL;
            NEW.profit_amount := NULL;
            RETURN NEW;
          END IF;

          SELECT settlement.buy_rate, settlement.settlement_amount
            INTO settle_rate, settle_amount
          FROM product_settlements settlement
          WHERE settlement.transaction_item_id = NEW.id
            AND settlement.type = 'TT'
            AND settlement.deleted_at IS NULL
            AND settlement.status IN (
              'PENDING_ISSUER_SETTLEMENT',
              'ISSUER_SETTLED'
            )
          ORDER BY settlement.branch_settlement_date DESC NULLS LAST,
                   settlement.created_at DESC
          LIMIT 1;

          IF settle_amount IS NULL THEN
            NEW.hold_cost := NULL;
            NEW.profit := NULL;
            NEW.profit_amount := NULL;
            RETURN NEW;
          END IF;

          NEW.hold_cost := settle_rate;
          NEW.profit := NULL;
          NEW.profit_amount := ROUND(NEW.amount - settle_amount, 2);
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
        FROM product_settlements settlement
        WHERE settlement.transaction_item_id = ti.id
          AND ti.deal_cover_id IS NOT NULL
          AND ti.deleted_at IS NULL
          AND settlement.deleted_at IS NULL
          AND settlement.type = 'TT'
          AND settlement.status IN (
            'PENDING_ISSUER_SETTLEMENT',
            'ISSUER_SETTLED'
          );

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

          SELECT settlement.buy_rate, settlement.settlement_amount
            INTO card_settle_rate, card_settle_amount
          FROM product_settlements settlement
          WHERE settlement.transaction_item_id = NEW.id
            AND settlement.deleted_at IS NULL
            AND settlement.status IS DISTINCT FROM 'CANCELLED'
            AND settlement.branch_settlement_entry_id IS NOT NULL
          ORDER BY settlement.branch_settlement_date DESC NULLS LAST,
                   settlement.created_at DESC
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
