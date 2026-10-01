import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Branch/issuer CARD settle posting sets product_settlements.id on each
 * transaction_item.card_stock_reference_id, not the transaction header.
 * card_stock_on_transaction_item SETTLE still looked up only
 * t.card_stock_reference_id → RAISE "CARD settlement <NULL> does not exist"
 * on HO accept / postBranchDocument.
 */
export class FixCardSettleItemReference1790769693139
  implements MigrationInterface
{
  name = "FixCardSettleItemReference1790769693139";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        function_definition text;
      BEGIN
        function_definition := pg_get_functiondef(
          'public.card_stock_on_transaction_item()'::regprocedure
        );

        IF function_definition LIKE
          '%FROM product_settlements WHERE id=t.card_stock_reference_id%'
        THEN
          function_definition := replace(
            function_definition,
            'FROM product_settlements WHERE id=t.card_stock_reference_id FOR UPDATE;
                IF r.id IS NULL THEN RAISE EXCEPTION ''CARD settlement % does not exist'', t.card_stock_reference_id; END IF;',
            'FROM product_settlements WHERE id=coalesce(NEW.card_stock_reference_id, t.card_stock_reference_id) FOR UPDATE;
                IF r.id IS NULL THEN RAISE EXCEPTION ''CARD settlement % does not exist'', coalesce(NEW.card_stock_reference_id, t.card_stock_reference_id); END IF;'
          );
        END IF;

        EXECUTE function_definition;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        function_definition text;
      BEGIN
        function_definition := pg_get_functiondef(
          'public.card_stock_on_transaction_item()'::regprocedure
        );

        IF function_definition LIKE
          '%FROM product_settlements WHERE id=coalesce(NEW.card_stock_reference_id, t.card_stock_reference_id)%'
        THEN
          function_definition := replace(
            function_definition,
            'FROM product_settlements WHERE id=coalesce(NEW.card_stock_reference_id, t.card_stock_reference_id) FOR UPDATE;
                IF r.id IS NULL THEN RAISE EXCEPTION ''CARD settlement % does not exist'', coalesce(NEW.card_stock_reference_id, t.card_stock_reference_id); END IF;',
            'FROM product_settlements WHERE id=t.card_stock_reference_id FOR UPDATE;
                IF r.id IS NULL THEN RAISE EXCEPTION ''CARD settlement % does not exist'', t.card_stock_reference_id; END IF;'
          );
        END IF;

        EXECUTE function_definition;
      END $$;
    `);
  }
}
