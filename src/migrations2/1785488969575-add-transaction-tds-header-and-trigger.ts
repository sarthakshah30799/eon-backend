import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTransactionTdsHeaderAndTrigger1785488969575 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
          ALTER TABLE "transactions"
          ADD COLUMN IF NOT EXISTS "tds_amount" numeric(18,2) NOT NULL DEFAULT 0
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
            v_party_profile_snapshot jsonb;
            v_loan_amount numeric;
            v_declared_amount numeric;
            v_itr_filed boolean;
            v_tcs_declaration_accepted boolean;
            v_is_proprietorship boolean;
            v_item_commission_total numeric;
            v_is_tds_deducted boolean;
            v_tds_rate numeric;
            v_tds_amount numeric;
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
              COALESCE(t.party_profile_snapshot, '{}'::jsonb),
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
              v_party_profile_snapshot,
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

            SELECT COALESCE(SUM(COALESCE(ti.commission, 0)), 0)
            INTO v_item_commission_total
            FROM transaction_items ti
            WHERE ti.transaction_id = p_transaction_id;

            v_is_tds_deducted := COALESCE(
              NULLIF(BTRIM(COALESCE(v_party_profile_snapshot->>'isTdsDeducted', '')), '')::boolean,
              false
            );
            v_tds_rate := COALESCE(
              NULLIF(BTRIM(COALESCE(v_party_profile_snapshot->>'tds', '')), '')::numeric,
              0
            );
            v_tds_amount := CASE
              WHEN v_is_tds_deducted AND COALESCE(v_item_commission_total, 0) > 0 AND v_tds_rate > 0
                THEN ROUND(v_item_commission_total * v_tds_rate / 100, 2)
              ELSE 0
            END;

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
              tds_amount = COALESCE(v_tds_amount, 0),
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
          CREATE OR REPLACE FUNCTION public.transaction_child_tcs_refresh_trigger()
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
              v_transaction_id := OLD.transaction_id;
            ELSE
              v_transaction_id := NEW.transaction_id;
            END IF;

            PERFORM public.refresh_transaction_tcs(v_transaction_id);

            IF TG_OP = 'UPDATE' AND OLD.transaction_id IS DISTINCT FROM NEW.transaction_id THEN
              PERFORM public.refresh_transaction_tcs(OLD.transaction_id);
            END IF;

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
            purpose_snapshot,
            party_profile_snapshot
          ON "transactions"
          FOR EACH ROW
          EXECUTE FUNCTION public.transaction_tcs_refresh_trigger();
        `);

    await queryRunner.query(`
          DROP TRIGGER IF EXISTS transaction_items_tcs_refresh_trigger ON "transaction_items";
        `);
    await queryRunner.query(`
          CREATE TRIGGER transaction_items_tcs_refresh_trigger
          AFTER INSERT OR UPDATE OR DELETE ON "transaction_items"
          FOR EACH ROW
          EXECUTE FUNCTION public.transaction_child_tcs_refresh_trigger();
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
          DROP TRIGGER IF EXISTS transaction_items_tcs_refresh_trigger ON "transaction_items";
        `);
    await queryRunner.query(`
          DROP TRIGGER IF EXISTS transaction_tcs_refresh_trigger ON "transactions";
        `);
    await queryRunner.query(`
          DROP FUNCTION IF EXISTS public.transaction_child_tcs_refresh_trigger();
        `);
    await queryRunner.query(`
          DROP FUNCTION IF EXISTS public.transaction_tcs_refresh_trigger();
        `);
    await queryRunner.query(`
          DROP FUNCTION IF EXISTS public.refresh_transaction_tcs(uuid);
        `);
    await queryRunner.query(`
          ALTER TABLE "transactions"
          DROP COLUMN IF EXISTS "tds_amount";
        `);
  }
}
