import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTransactionTcsFunctionsFixed1784910474659 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.calculate_transaction_tcs_preview(
        p_payload jsonb
      )
      RETURNS jsonb
      LANGUAGE plpgsql
      AS $$
      DECLARE
        v_transaction_type text := UPPER(COALESCE(p_payload->>'transactionType', ''));
        v_purpose_snapshot jsonb := COALESCE(p_payload->'purposeSnapshot', '{}'::jsonb);
        v_purpose_id text := NULLIF(BTRIM(COALESCE(p_payload->>'purposeId', '')), '');
        v_pre_tcs_final_amount numeric := COALESCE(NULLIF(BTRIM(COALESCE(p_payload->>'preTcsFinalAmount', '')), '')::numeric, 0);
        v_item_base_amount numeric := COALESCE(NULLIF(BTRIM(COALESCE(p_payload->>'itemBaseAmount', '')), '')::numeric, 0);
        v_item_tax_amount numeric := COALESCE(NULLIF(BTRIM(COALESCE(p_payload->>'itemTaxAmount', '')), '')::numeric, 0);
        v_additional_charge_base_amount numeric := COALESCE(NULLIF(BTRIM(COALESCE(p_payload->>'additionalChargeBaseAmount', '')), '')::numeric, 0);
        v_additional_charge_tax_amount numeric := COALESCE(NULLIF(BTRIM(COALESCE(p_payload->>'additionalChargeTaxAmount', '')), '')::numeric, 0);
        v_declared_amount numeric := COALESCE(NULLIF(BTRIM(COALESCE(p_payload->>'declaredAmount', '')), '')::numeric, 0);
        v_loan_amount numeric := COALESCE(NULLIF(BTRIM(COALESCE(p_payload->>'loanAmount', '')), '')::numeric, 0);
        v_threshold numeric := COALESCE(NULLIF(BTRIM(COALESCE(v_purpose_snapshot->>'threshold', '')), '')::numeric, 0);
        v_base_rate numeric := COALESCE(NULLIF(BTRIM(COALESCE(v_purpose_snapshot->>'rate', '')), '')::numeric, 0);
        v_rate_type text := UPPER(COALESCE(v_purpose_snapshot->>'rateType', 'PERCENT'));
        v_tcs_declaration_accepted boolean := COALESCE(NULLIF(BTRIM(COALESCE(p_payload->>'tcsDeclarationAccepted', '')), '')::boolean, false);
        v_itr_filed boolean := COALESCE(NULLIF(BTRIM(COALESCE(p_payload->>'itrFiled', '')), '')::boolean, false);
        v_is_proprietorship boolean := COALESCE(NULLIF(BTRIM(COALESCE(p_payload->>'isProprietorship', '')), '')::boolean, false);
        v_max_rate_percent numeric := COALESCE(NULLIF(BTRIM(COALESCE(p_payload->>'maxTcsRatePercent', '')), '')::numeric, 20);
        v_effective_threshold numeric := GREATEST(v_threshold, v_loan_amount);
        v_effective_amount numeric := 0;
        v_taxable_amount numeric := 0;
        v_total_tcs numeric := 0;
        v_final_amount numeric := 0;
        v_slab jsonb;
        v_slab_from numeric;
        v_slab_to numeric;
        v_slab_base numeric;
        v_slab_rate numeric;
        v_slab_rate_type text;
        v_effective_rate numeric;
        v_line_no integer := 0;
        v_weighted_rate numeric := 0;
        v_breakdown_rows jsonb := '[]'::jsonb;
        v_has_slabs boolean := COALESCE(jsonb_array_length(COALESCE(v_purpose_snapshot->'slabs', '[]'::jsonb)), 0) > 0;
        v_use_purpose_rate boolean := false;
        v_row_tcs numeric := 0;
      BEGIN
        IF v_pre_tcs_final_amount <= 0 THEN
          v_pre_tcs_final_amount := ROUND(
            v_item_base_amount
            + v_item_tax_amount
            + v_additional_charge_base_amount
            + v_additional_charge_tax_amount,
            2
          );
        END IF;

        v_effective_amount := ROUND(v_pre_tcs_final_amount + v_declared_amount, 2);

        IF v_transaction_type <> 'SALE' OR v_tcs_declaration_accepted THEN
          v_taxable_amount := 0;
        ELSE
          v_taxable_amount := GREATEST(v_effective_amount - v_effective_threshold, 0);
        END IF;

        IF v_taxable_amount > 0 AND NOT v_tcs_declaration_accepted AND v_transaction_type = 'SALE' THEN
          IF v_has_slabs THEN
            FOR v_slab IN
              SELECT value
              FROM jsonb_array_elements(COALESCE(v_purpose_snapshot->'slabs', '[]'::jsonb)) AS value
              ORDER BY COALESCE(NULLIF(BTRIM(COALESCE(value->>'sortOrder', '')), '')::integer, 0)
            LOOP
              v_slab_from := COALESCE(NULLIF(BTRIM(COALESCE(v_slab->>'fromAmount', '')), '')::numeric, 0);
              v_slab_to := NULLIF(BTRIM(COALESCE(v_slab->>'toAmount', '')), '')::numeric;
              v_slab_rate := COALESCE(NULLIF(BTRIM(COALESCE(v_slab->>'rate', '')), '')::numeric, 0);
              v_slab_rate_type := UPPER(COALESCE(v_slab->>'rateType', v_rate_type));
              v_effective_rate := v_slab_rate;
              v_slab_base := GREATEST(LEAST(v_taxable_amount, COALESCE(v_slab_to, v_taxable_amount)) - v_slab_from, 0);

              IF v_slab_base > 0 THEN
                IF v_slab_rate_type = 'PERCENT' AND NOT v_itr_filed THEN
                  v_effective_rate := LEAST(v_slab_rate * 2, v_max_rate_percent);
                END IF;

                v_row_tcs := CASE
                  WHEN v_slab_rate_type = 'RUPEES' THEN ROUND(v_effective_rate, 2)
                  ELSE ROUND(v_slab_base * v_effective_rate / 100, 2)
                END;

                v_total_tcs := ROUND(v_total_tcs + v_row_tcs, 2);
                v_line_no := v_line_no + 1;
                v_breakdown_rows := v_breakdown_rows || jsonb_build_array(
                  jsonb_build_object(
                    'lineNo', v_line_no,
                    'purposeId', v_purpose_id,
                    'purposeSlabId', NULLIF(BTRIM(COALESCE(v_slab->>'id', '')), ''),
                    'baseAmount', ROUND(v_slab_base, 2),
                    'ratePercent', ROUND(v_effective_rate, 4),
                    'rateType', v_slab_rate_type,
                    'tcsAmount', ROUND(v_row_tcs, 2)
                  )
                );
              END IF;
            END LOOP;
          ELSE
            v_use_purpose_rate := true;
            v_effective_rate := v_base_rate;
            IF v_rate_type = 'PERCENT' AND NOT v_itr_filed THEN
              v_effective_rate := LEAST(v_base_rate * 2, v_max_rate_percent);
            END IF;

            v_row_tcs := CASE
              WHEN v_rate_type = 'RUPEES' THEN ROUND(v_effective_rate, 2)
              ELSE ROUND(v_taxable_amount * v_effective_rate / 100, 2)
            END;
            v_total_tcs := ROUND(v_row_tcs, 2);
            v_breakdown_rows := jsonb_build_array(
              jsonb_build_object(
                'lineNo', 1,
                'purposeId', v_purpose_id,
                'purposeSlabId', NULL,
                'baseAmount', ROUND(v_taxable_amount, 2),
                'ratePercent', ROUND(v_effective_rate, 4),
                'rateType', v_rate_type,
                'tcsAmount', ROUND(v_row_tcs, 2)
              )
            );
          END IF;
        END IF;

        IF v_taxable_amount > 0 THEN
          v_weighted_rate := ROUND((v_total_tcs / v_taxable_amount) * 100, 4);
        ELSE
          v_weighted_rate := 0;
        END IF;

        v_final_amount := ROUND(v_pre_tcs_final_amount + v_total_tcs, 2);

        RETURN jsonb_build_object(
          'transactionType', v_transaction_type,
          'purposeId', v_purpose_id,
          'preTcsFinalAmount', ROUND(v_pre_tcs_final_amount, 2),
          'effectiveAmount', ROUND(v_effective_amount, 2),
          'threshold', ROUND(v_threshold, 2),
          'effectiveThreshold', ROUND(v_effective_threshold, 2),
          'loanAmount', ROUND(v_loan_amount, 2),
          'declaredAmount', ROUND(v_declared_amount, 2),
          'taxableAmount', ROUND(v_taxable_amount, 2),
          'tcsRatePercent', ROUND(v_weighted_rate, 4),
          'tcsRateType', CASE
            WHEN v_use_purpose_rate THEN v_rate_type
            WHEN v_has_slabs AND jsonb_array_length(v_breakdown_rows) > 0 THEN UPPER(COALESCE((v_breakdown_rows->0->>'rateType'), v_rate_type))
            ELSE v_rate_type
          END,
          'tcsAmount', ROUND(v_total_tcs, 2),
          'finalAmount', ROUND(v_final_amount, 2),
          'tcsDeclarationAccepted', v_tcs_declaration_accepted,
          'itrFiled', v_itr_filed,
          'isProprietorship', v_is_proprietorship,
          'breakdowns', COALESCE(v_breakdown_rows, '[]'::jsonb)
        );
      END;
      $$;
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.refresh_transaction_tcs(
        p_transaction_id uuid
      )
      RETURNS void
      LANGUAGE plpgsql
      AS $$
      DECLARE
        v_transaction_type text;
        v_item_base_amount numeric;
        v_item_tax_amount numeric;
        v_additional_charge_base_amount numeric;
        v_additional_charge_tax_amount numeric;
        v_pre_tcs_final_amount numeric;
        v_purpose_id uuid;
        v_purpose_snapshot jsonb;
        v_loan_amount numeric;
        v_declared_amount numeric;
        v_itr_filed boolean;
        v_tcs_declaration_accepted boolean;
        v_is_proprietorship boolean;
        v_preview jsonb;
        v_breakdown jsonb;
        v_created_by uuid;
        v_updated_by uuid;
      BEGIN
        SELECT
          t.transaction_type::text,
          COALESCE(t.item_base_amount, 0),
          COALESCE(t.item_tax_amount, 0),
          COALESCE(t.additional_charge_base_amount, 0),
          COALESCE(t.additional_charge_tax_amount, 0),
          t.purpose_id,
          COALESCE(t.purpose_snapshot, '{}'::jsonb),
          COALESCE(t.loan_amount, 0),
          COALESCE(t.declared_amount, 0),
          COALESCE(t.itr_filed, false),
          COALESCE(t.tcs_declaration_accepted, false),
          COALESCE(t.is_proprietorship, false),
          t.created_by,
          t.updated_by
        INTO
          v_transaction_type,
          v_item_base_amount,
          v_item_tax_amount,
          v_additional_charge_base_amount,
          v_additional_charge_tax_amount,
          v_purpose_id,
          v_purpose_snapshot,
          v_loan_amount,
          v_declared_amount,
          v_itr_filed,
          v_tcs_declaration_accepted,
          v_is_proprietorship,
          v_created_by,
          v_updated_by
        FROM transactions t
        WHERE t.id = p_transaction_id;

        IF NOT FOUND THEN
          RETURN;
        END IF;

        v_pre_tcs_final_amount := ROUND(
          COALESCE(v_item_base_amount, 0)
          + COALESCE(v_item_tax_amount, 0)
          + COALESCE(v_additional_charge_base_amount, 0)
          + COALESCE(v_additional_charge_tax_amount, 0),
          2
        );

        v_preview := public.calculate_transaction_tcs_preview(
          jsonb_build_object(
            'transactionType', v_transaction_type,
            'purposeId', v_purpose_id,
            'purposeSnapshot', v_purpose_snapshot,
            'preTcsFinalAmount', v_pre_tcs_final_amount,
            'loanAmount', v_loan_amount,
            'declaredAmount', v_declared_amount,
            'itrFiled', v_itr_filed,
            'tcsDeclarationAccepted', v_tcs_declaration_accepted,
            'isProprietorship', v_is_proprietorship,
            'maxTcsRatePercent', 20
          )
        );

        UPDATE transactions
        SET
          pre_tcs_final_amount = COALESCE((v_preview->>'preTcsFinalAmount')::numeric, 0),
          tcs_rate_percent = COALESCE((v_preview->>'tcsRatePercent')::numeric, 0),
          tcs_rate_type = CASE
            WHEN COALESCE(v_preview->>'tcsRateType', '') = '' THEN NULL
            ELSE COALESCE(v_preview->>'tcsRateType', NULL)::"public"."purpose_rate_type_enum"
          END,
          tcs_amount = COALESCE((v_preview->>'tcsAmount')::numeric, 0),
          final_amount = COALESCE((v_preview->>'finalAmount')::numeric, 0),
          updated_at = now()
        WHERE id = p_transaction_id;

        DELETE FROM transaction_tcs_breakdowns
        WHERE transaction_id = p_transaction_id;

        FOR v_breakdown IN
          SELECT value
          FROM jsonb_array_elements(COALESCE(v_preview->'breakdowns', '[]'::jsonb)) AS value
        LOOP
          INSERT INTO transaction_tcs_breakdowns (
            id,
            created_at,
            updated_at,
            created_by,
            updated_by,
            deleted_at,
            deleted_by,
            transaction_id,
            line_no,
            purpose_id,
            purpose_slab_id,
            base_amount,
            rate_percent,
            rate_type,
            tcs_amount
          ) VALUES (
            uuid_generate_v4(),
            now(),
            now(),
            v_created_by,
            v_updated_by,
            NULL,
            NULL,
            p_transaction_id,
            COALESCE((v_breakdown->>'lineNo')::integer, 1),
            NULLIF(BTRIM(COALESCE(v_breakdown->>'purposeId', '')), '')::uuid,
            NULLIF(BTRIM(COALESCE(v_breakdown->>'purposeSlabId', '')), '')::uuid,
            COALESCE((v_breakdown->>'baseAmount')::numeric, 0),
            COALESCE((v_breakdown->>'ratePercent')::numeric, 0),
            COALESCE(NULLIF(BTRIM(COALESCE(v_breakdown->>'rateType', '')), ''), 'PERCENT')::"public"."purpose_rate_type_enum",
            COALESCE((v_breakdown->>'tcsAmount')::numeric, 0)
          );
        END LOOP;
      END;
      $$;
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.transaction_tcs_refresh_trigger()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      DECLARE
        v_transaction_id uuid;
      BEGIN
        IF pg_trigger_depth() > 1 THEN
          RETURN NULL;
        END IF;

        IF TG_OP = 'DELETE' THEN
          v_transaction_id := OLD.id;
        ELSE
          v_transaction_id := NEW.id;
        END IF;

        PERFORM public.refresh_transaction_tcs(v_transaction_id);
        RETURN NULL;
      END;
      $$;
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS transaction_tcs_refresh_trigger ON "transactions";
    `);
    await queryRunner.query(`
      CREATE TRIGGER transaction_tcs_refresh_trigger
      AFTER INSERT OR UPDATE OF
        transaction_type,
        item_base_amount,
        item_tax_amount,
        additional_charge_base_amount,
        additional_charge_tax_amount,
        loan_amount,
        declared_amount,
        itr_filed,
        tcs_declaration_accepted,
        is_proprietorship,
        purpose_snapshot
      ON "transactions"
      FOR EACH ROW
      EXECUTE FUNCTION public.transaction_tcs_refresh_trigger();
    `);

    await queryRunner.query(`
      DO $$
      DECLARE
        v_transaction_id uuid;
      BEGIN
        FOR v_transaction_id IN
          SELECT id
          FROM transactions
        LOOP
          PERFORM public.refresh_transaction_tcs(v_transaction_id);
        END LOOP;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS transaction_tcs_refresh_trigger ON "transactions";
    `);
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS public.transaction_tcs_refresh_trigger();
    `);
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS public.refresh_transaction_tcs(uuid);
    `);
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS public.calculate_transaction_tcs_preview(jsonb);
    `);
  }
}
