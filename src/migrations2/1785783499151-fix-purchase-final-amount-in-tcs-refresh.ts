import { MigrationInterface, QueryRunner } from "typeorm";

export class FixPurchaseFinalAmountInTcsRefresh1785783499151 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        v_sql text;
        v_pattern text := $pattern$v_pre_tcs_final_amount[[:space:]]*:=[[:space:]]*ROUND[(][[:space:]]*COALESCE[(]v_item_base_amount,[[:space:]]*0[)][[:space:]]*[+][[:space:]]*COALESCE[(]v_item_tax_amount,[[:space:]]*0[)][[:space:]]*[+][[:space:]]*COALESCE[(]v_additional_charge_base_amount,[[:space:]]*0[)][[:space:]]*[+][[:space:]]*COALESCE[(]v_additional_charge_tax_amount,[[:space:]]*0[)][[:space:]]*,[[:space:]]*2[[:space:]]*[)];$pattern$;
        v_new text := $new$v_pre_tcs_final_amount := ROUND(
          CASE
            WHEN UPPER(COALESCE(v_transaction_type, '')) = 'PURCHASE' THEN
              COALESCE(v_item_base_amount, 0)
              - COALESCE(v_item_tax_amount, 0)
              - COALESCE(v_additional_charge_base_amount, 0)
              - COALESCE(v_additional_charge_tax_amount, 0)
            ELSE
              COALESCE(v_item_base_amount, 0)
              + COALESCE(v_item_tax_amount, 0)
              + COALESCE(v_additional_charge_base_amount, 0)
              + COALESCE(v_additional_charge_tax_amount, 0)
          END,
          2
        );$new$;
      BEGIN
        SELECT pg_get_functiondef('public.refresh_transaction_tcs(uuid)'::regprocedure)
        INTO v_sql;

        IF v_sql IS NULL OR v_sql !~ v_pattern THEN
          RAISE EXCEPTION 'Base final amount formula was not found in refresh_transaction_tcs';
        END IF;

        EXECUTE regexp_replace(v_sql, v_pattern, v_new, 1, 1, 'n');
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        v_sql text;
        v_pattern text := $pattern$v_pre_tcs_final_amount[[:space:]]*:=[[:space:]]*ROUND[(][[:space:]]*CASE(.|\n)*?END,[[:space:]]*2[[:space:]]*[)];$pattern$;
        v_new text := $new$v_pre_tcs_final_amount := ROUND(
          COALESCE(v_item_base_amount, 0)
          + COALESCE(v_item_tax_amount, 0)
          + COALESCE(v_additional_charge_base_amount, 0)
          + COALESCE(v_additional_charge_tax_amount, 0),
          2
        );$new$;
      BEGIN
        SELECT pg_get_functiondef('public.refresh_transaction_tcs(uuid)'::regprocedure)
        INTO v_sql;

        IF v_sql IS NULL OR v_sql !~ v_pattern THEN
          RAISE EXCEPTION 'Corrected final amount formula was not found in refresh_transaction_tcs';
        END IF;

        EXECUTE regexp_replace(v_sql, v_pattern, v_new, 1, 1, 'n');
      END
      $$;
    `);
  }
}
