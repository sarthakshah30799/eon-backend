import { MigrationInterface, QueryRunner } from "typeorm";

export class CardStockSettleMatchingSeries1787463003829 implements MigrationInterface {
    name = "CardStockSettleMatchingSeries1787463003829";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            DECLARE
              function_definition text;
            BEGIN
              function_definition := pg_get_functiondef(
                'public.card_stock_on_transaction_item()'::regprocedure
              );

              IF function_definition LIKE '%branch_id=r.branch_id AND is_active=true%' THEN
                function_definition := replace(
                  function_definition,
                  'branch_id=r.branch_id AND is_active=true',
                  'branch_id=r.branch_id AND series=r.series'
                );
              ELSIF function_definition LIKE '%branch_id = r.branch_id AND is_active = true%' THEN
                function_definition := replace(
                  function_definition,
                  'branch_id = r.branch_id AND is_active = true',
                  'branch_id = r.branch_id AND series = r.series'
                );
              END IF;

              IF function_definition LIKE '%No active CARD balance exists for branch settlement%' THEN
                function_definition := replace(
                  function_definition,
                  'RAISE EXCEPTION ''No active CARD balance exists for branch settlement''',
                  'RAISE EXCEPTION ''No CARD balance exists for settlement series %'', r.series'
                );
              END IF;

              EXECUTE function_definition;
            END;
            $$;
        `);

        await queryRunner.query(`
            ALTER TABLE card_stock_balance DISABLE TRIGGER card_stock_balance_recalculate_sale_profit_update;
            ALTER TABLE card_stock_balance DISABLE TRIGGER card_stock_balance_recalculate_sale_profit_insert;

            UPDATE card_stock_balance b
               SET settle_date = s.branch_settlement_date,
                   settle_rate = s.buy_rate,
                   settle_amount = s.settlement_amount,
                   settle_entry_id = s.branch_settlement_entry_id,
                   updated_at = now()
            FROM card_stock_settlements s
            WHERE s.card_id = b.card_id
              AND s.branch_id = b.branch_id
              AND s.series = b.series
              AND s.deleted_at IS NULL
              AND s.branch_settlement_entry_id IS NOT NULL;

            ALTER TABLE card_stock_balance ENABLE TRIGGER card_stock_balance_recalculate_sale_profit_insert;
            ALTER TABLE card_stock_balance ENABLE TRIGGER card_stock_balance_recalculate_sale_profit_update;
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

              IF function_definition LIKE '%branch_id=r.branch_id AND series=r.series%' THEN
                function_definition := replace(
                  function_definition,
                  'branch_id=r.branch_id AND series=r.series',
                  'branch_id=r.branch_id AND is_active=true'
                );
              ELSIF function_definition LIKE '%branch_id = r.branch_id AND series = r.series%' THEN
                function_definition := replace(
                  function_definition,
                  'branch_id = r.branch_id AND series = r.series',
                  'branch_id = r.branch_id AND is_active = true'
                );
              END IF;

              IF function_definition LIKE '%No CARD balance exists for settlement series %' THEN
                function_definition := replace(
                  function_definition,
                  'RAISE EXCEPTION ''No CARD balance exists for settlement series %'', r.series',
                  'RAISE EXCEPTION ''No active CARD balance exists for branch settlement'''
                );
              END IF;

              EXECUTE function_definition;
            END;
            $$;
        `);
    }
}
