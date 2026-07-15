import { MigrationInterface, QueryRunner } from "typeorm";

export class AddHoldCostProfitToTransactionItems1784095899089
  implements MigrationInterface
{
  name = "AddHoldCostProfitToTransactionItems1784095899089";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transaction_items" ADD "hold_cost" numeric(18,7)`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_items" ADD "profit" numeric(18,2)`,
    );

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
          purchase_amount := purchase_amount + (COALESCE(NEW.quantity, 0) * COALESCE(NEW.rate, 0));
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
      DROP TRIGGER IF EXISTS transaction_items_hold_profit_trigger ON "transaction_items";
      CREATE TRIGGER transaction_items_hold_profit_trigger
      BEFORE INSERT OR UPDATE ON "transaction_items"
      FOR EACH ROW
      EXECUTE FUNCTION public.transaction_items_hold_profit_trigger();
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.transactions_recalculate_item_hold_profit_trigger()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        UPDATE transaction_items
        SET updated_at = updated_at
        WHERE transaction_id = NEW.id;
        RETURN NEW;
      END;
      $$;
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS transactions_recalculate_item_hold_profit_trigger ON "transactions";
      CREATE TRIGGER transactions_recalculate_item_hold_profit_trigger
      AFTER UPDATE OF status ON "transactions"
      FOR EACH ROW
      WHEN (OLD.status IS DISTINCT FROM NEW.status)
      EXECUTE FUNCTION public.transactions_recalculate_item_hold_profit_trigger();
    `);

    await queryRunner.query(`
      WITH purchase_totals AS (
        SELECT
          ti.product_id,
          ti.currency_id,
          ROUND(
            SUM(ti.quantity * ti.rate) / NULLIF(SUM(ti.quantity), 0),
            7
          ) AS hold_cost
        FROM transaction_items ti
        INNER JOIN transactions t ON t.id = ti.transaction_id
        WHERE t.status = 'APPROVED'
          AND t.transaction_type = 'PURCHASE'
        GROUP BY ti.product_id, ti.currency_id
      ),
      computed AS (
        SELECT
          ti.id,
          CASE
            WHEN t.status = 'APPROVED' THEN pt.hold_cost
            ELSE NULL
          END AS hold_cost,
          CASE
            WHEN t.status = 'APPROVED'
             AND t.transaction_type = 'SALE'
             AND pt.hold_cost IS NOT NULL THEN
              ROUND(ti.rate - pt.hold_cost, 2)
            ELSE NULL
          END AS profit
        FROM transaction_items ti
        INNER JOIN transactions t ON t.id = ti.transaction_id
        LEFT JOIN purchase_totals pt
          ON pt.product_id = ti.product_id
         AND pt.currency_id = ti.currency_id
      )
      UPDATE transaction_items ti
      SET
        hold_cost = c.hold_cost,
        profit = c.profit
      FROM computed c
      WHERE c.id = ti.id;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS transactions_recalculate_item_hold_profit_trigger ON "transactions";
    `);
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS public.transactions_recalculate_item_hold_profit_trigger();
    `);
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS transaction_items_hold_profit_trigger ON "transaction_items";
    `);
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS public.transaction_items_hold_profit_trigger();
    `);
    await queryRunner.query(`ALTER TABLE "transaction_items" DROP COLUMN "profit"`);
    await queryRunner.query(`ALTER TABLE "transaction_items" DROP COLUMN "hold_cost"`);
  }
}
