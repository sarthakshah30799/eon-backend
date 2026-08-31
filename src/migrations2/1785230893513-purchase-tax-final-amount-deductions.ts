import { MigrationInterface, QueryRunner } from "typeorm";

export class PurchaseTaxFinalAmountDeductions1785230893513 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
          DO $$
          DECLARE
            v_sql text;
          BEGIN
            SELECT pg_get_functiondef('public.calculate_transaction_gst_preview(jsonb)'::regprocedure)
            INTO v_sql;

            v_sql := replace(
              v_sql,
              'v_total_base := ROUND(v_item_base + v_charge_base, 2);',
              'v_total_base := ROUND(CASE WHEN v_transaction_type = ''PURCHASE'' THEN v_item_base - v_charge_base ELSE v_item_base + v_charge_base END, 2);'
            );

            v_sql := replace(
              v_sql,
              'v_final_amount := ROUND(v_total_base + v_total_tax, 2);',
              'v_final_amount := ROUND(CASE WHEN v_transaction_type = ''PURCHASE'' THEN v_total_base - v_total_tax ELSE v_total_base + v_total_tax END, 2);'
            );

            EXECUTE v_sql;
          END
          $$;
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
          DO $$
          DECLARE
            v_sql text;
          BEGIN
            SELECT pg_get_functiondef('public.calculate_transaction_gst_preview(jsonb)'::regprocedure)
            INTO v_sql;

            v_sql := replace(
              v_sql,
              'v_total_base := ROUND(CASE WHEN v_transaction_type = ''PURCHASE'' THEN v_item_base - v_charge_base ELSE v_item_base + v_charge_base END, 2);',
              'v_total_base := ROUND(v_item_base + v_charge_base, 2);'
            );

            v_sql := replace(
              v_sql,
              'v_final_amount := ROUND(CASE WHEN v_transaction_type = ''PURCHASE'' THEN v_total_base - v_total_tax ELSE v_total_base + v_total_tax END, 2);',
              'v_final_amount := ROUND(v_total_base + v_total_tax, 2);'
            );

            EXECUTE v_sql;
          END
          $$;
        `);
  }
}
