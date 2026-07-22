import { MigrationInterface, QueryRunner } from "typeorm";

export class TaxTriggerFunctions1784706716889 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1
              FROM pg_type
              WHERE typname = 'transaction_tax_split_mode_enum'
            ) THEN
              CREATE TYPE "public"."transaction_tax_split_mode_enum" AS ENUM ('CGST_SGST', 'IGST');
            END IF;
          END
          $$;
        `);

        await queryRunner.query(`
          CREATE OR REPLACE FUNCTION public.calculate_transaction_gst_components(
            p_transaction_type text,
            p_apply_tax boolean,
            p_tax_rate_percent numeric,
            p_item_base_amount numeric,
            p_additional_charge_base_amount numeric,
            p_branch_state text,
            p_party_state text
          )
          RETURNS jsonb
          LANGUAGE plpgsql
          AS $$
          DECLARE
            v_item_base numeric := COALESCE(p_item_base_amount, 0);
            v_charge_base numeric := COALESCE(p_additional_charge_base_amount, 0);
            v_tax_rate numeric := COALESCE(p_tax_rate_percent, 0);
            v_apply_tax boolean := COALESCE(p_apply_tax, false);
            v_item_tax numeric := 0;
            v_charge_tax numeric := 0;
            v_total_tax numeric := 0;
            v_taxable_amount numeric := 0;
            v_final_amount numeric := 0;
            v_split_mode text := 'CGST_SGST';
            v_igst numeric := 0;
            v_cgst numeric := 0;
            v_sgst numeric := 0;
            v_branch_state text := NULLIF(BTRIM(COALESCE(p_branch_state, '')), '');
            v_party_state text := NULLIF(BTRIM(COALESCE(p_party_state, '')), '');
          BEGIN
            v_taxable_amount := ROUND(v_item_base + v_charge_base, 2);

            IF v_apply_tax THEN
              IF v_item_base <= 25000 THEN
                v_item_tax := 250;
              ELSIF v_item_base <= 100000 THEN
                v_item_tax := v_item_base * 0.01;
              ELSIF v_item_base < 1000000 THEN
                v_item_tax := 1000 + ((v_item_base - 100000) * 0.005);
              ELSE
                v_item_tax := 5500 + ((v_item_base - 1000000) * 0.001);
              END IF;

              v_item_tax := ROUND(COALESCE(v_item_tax, 0), 2);
              v_charge_tax := ROUND(v_charge_base * v_tax_rate / 100, 2);
            END IF;

            v_total_tax := ROUND(v_item_tax + v_charge_tax, 2);

            IF v_branch_state IS NULL OR v_party_state IS NULL OR UPPER(v_branch_state) = UPPER(v_party_state) THEN
              v_split_mode := 'CGST_SGST';
            ELSE
              v_split_mode := 'IGST';
            END IF;

            IF v_total_tax > 0 THEN
              IF v_split_mode = 'IGST' THEN
                v_igst := v_total_tax;
              ELSE
                v_cgst := ROUND(v_total_tax / 2.0, 2);
                v_sgst := ROUND(v_total_tax - v_cgst, 2);
              END IF;
            END IF;

            IF UPPER(COALESCE(p_transaction_type, '')) = 'PURCHASE' THEN
              v_final_amount := ROUND(v_item_base - v_item_tax - v_charge_base - v_charge_tax, 2);
            ELSE
              v_final_amount := ROUND(v_item_base + v_item_tax + v_charge_base + v_charge_tax, 2);
            END IF;

            RETURN jsonb_build_object(
              'transactionType', UPPER(COALESCE(p_transaction_type, '')),
              'applyTax', v_apply_tax,
              'taxRatePercent', ROUND(v_tax_rate, 4),
              'taxableAmount', ROUND(v_taxable_amount, 2),
              'itemBaseAmount', ROUND(v_item_base, 2),
              'itemTaxAmount', ROUND(v_item_tax, 2),
              'additionalChargeBaseAmount', ROUND(v_charge_base, 2),
              'additionalChargeTaxAmount', ROUND(v_charge_tax, 2),
              'igstAmount', ROUND(v_igst, 2),
              'cgstAmount', ROUND(v_cgst, 2),
              'sgstAmount', ROUND(v_sgst, 2),
              'finalAmount', ROUND(v_final_amount, 2),
              'splitMode', v_split_mode,
              'branchStateName', v_branch_state,
              'partyStateName', v_party_state
            );
          END;
          $$;
        `);

        await queryRunner.query(`
          CREATE OR REPLACE FUNCTION public.calculate_transaction_gst_preview(
            p_payload jsonb
          )
          RETURNS jsonb
          LANGUAGE plpgsql
          AS $$
          DECLARE
            v_transaction_type text := COALESCE(p_payload->>'transactionType', '');
            v_apply_tax boolean := COALESCE((p_payload->>'partyProfileApplyTax')::boolean, false);
            v_tax_rate numeric := COALESCE((p_payload->>'taxRatePercent')::numeric, 0);
            v_branch_state text := COALESCE(
              NULLIF(BTRIM(COALESCE(p_payload->>'branchStateName', '')), ''),
              NULLIF(BTRIM(COALESCE(p_payload->'branchSnapshot'->>'gstStateName', '')), ''),
              NULLIF(BTRIM(COALESCE(p_payload->'branchSnapshot'->>'gstState', '')), ''),
              NULLIF(BTRIM(COALESCE(p_payload->'branchSnapshot'->>'stateName', '')), ''),
              NULLIF(BTRIM(COALESCE(p_payload->'branchSnapshot'->>'state', '')), '')
            );
            v_party_state text := COALESCE(
              NULLIF(BTRIM(COALESCE(p_payload->>'partyStateName', '')), ''),
              NULLIF(BTRIM(COALESCE(p_payload->'partyProfileSnapshot'->>'gstStateName', '')), ''),
              NULLIF(BTRIM(COALESCE(p_payload->'partyProfileSnapshot'->>'gstState', '')), ''),
              NULLIF(BTRIM(COALESCE(p_payload->'partyProfileSnapshot'->>'stateName', '')), ''),
              NULLIF(BTRIM(COALESCE(p_payload->'partyProfileSnapshot'->>'state', '')), '')
            );
            v_item_base numeric := 0;
            v_charge_base numeric := 0;
            v_item jsonb;
            v_charge jsonb;
          BEGIN
            FOR v_item IN
              SELECT value
              FROM jsonb_array_elements(COALESCE(p_payload->'items', '[]'::jsonb)) AS value
            LOOP
              v_item_base := v_item_base + (
                COALESCE((v_item->>'quantity')::numeric, 0)
                * COALESCE((v_item->>'rate')::numeric, 0)
                / COALESCE(NULLIF((v_item->>'per')::numeric, 0), 1)
              );
            END LOOP;

            FOR v_charge IN
              SELECT value
              FROM jsonb_array_elements(COALESCE(p_payload->'additionalCharges', '[]'::jsonb)) AS value
            LOOP
              v_charge_base := v_charge_base + COALESCE((v_charge->>'amount')::numeric, 0);
            END LOOP;

            RETURN public.calculate_transaction_gst_components(
              v_transaction_type,
              v_apply_tax,
              v_tax_rate,
              v_item_base,
              v_charge_base,
              v_branch_state,
              v_party_state
            );
          END;
          $$;
        `);

        await queryRunner.query(`
          CREATE OR REPLACE FUNCTION public.refresh_transaction_tax_summary(
            p_transaction_id uuid
          )
          RETURNS void
          LANGUAGE plpgsql
          AS $$
          DECLARE
            v_transaction_type text;
            v_apply_tax boolean;
            v_tax_rate numeric;
            v_branch_state text;
            v_party_state text;
            v_item_base numeric := 0;
            v_charge_base numeric := 0;
            v_summary jsonb;
          BEGIN
            SELECT
              t.transaction_type::text,
              COALESCE(t.tax_rate_percent, 0),
              COALESCE((t.party_profile_snapshot->>'applyTax')::boolean, false),
              COALESCE(
                NULLIF(BTRIM(COALESCE(t.branch_snapshot->>'gstStateName', '')), ''),
                NULLIF(BTRIM(COALESCE(t.branch_snapshot->>'gstState', '')), ''),
                NULLIF(BTRIM(COALESCE(t.branch_snapshot->>'stateName', '')), ''),
                NULLIF(BTRIM(COALESCE(t.branch_snapshot->>'state', '')), '')
              ),
              COALESCE(
                NULLIF(BTRIM(COALESCE(t.party_profile_snapshot->>'gstStateName', '')), ''),
                NULLIF(BTRIM(COALESCE(t.party_profile_snapshot->>'gstState', '')), ''),
                NULLIF(BTRIM(COALESCE(t.party_profile_snapshot->>'stateName', '')), ''),
                NULLIF(BTRIM(COALESCE(t.party_profile_snapshot->>'state', '')), '')
              )
            INTO
              v_transaction_type,
              v_tax_rate,
              v_apply_tax,
              v_branch_state,
              v_party_state
            FROM transactions t
            WHERE t.id = p_transaction_id;

            IF NOT FOUND THEN
              RETURN;
            END IF;

            SELECT COALESCE(
              SUM(
                COALESCE(ti.quantity, 0)
                * COALESCE(ti.rate, 0)
                / COALESCE(NULLIF(ti.per, 0), 1)
              ),
              0
            )
            INTO v_item_base
            FROM transaction_items ti
            WHERE ti.transaction_id = p_transaction_id;

            SELECT COALESCE(SUM(COALESCE(tac.amount, 0)), 0)
            INTO v_charge_base
            FROM transaction_additional_charges tac
            WHERE tac.transaction_id = p_transaction_id;

            v_summary := public.calculate_transaction_gst_components(
              v_transaction_type,
              v_apply_tax,
              v_tax_rate,
              v_item_base,
              v_charge_base,
              v_branch_state,
              v_party_state
            );

            INSERT INTO transaction_tax_summaries (
              transaction_id,
              tax_rate_percent,
              taxable_amount,
              item_base_amount,
              item_tax_amount,
              additional_charge_base_amount,
              additional_charge_tax_amount,
              igst_amount,
              cgst_amount,
              sgst_amount,
              final_amount,
              split_mode,
              created_at,
              updated_at
            ) VALUES (
              p_transaction_id,
              COALESCE((v_summary->>'taxRatePercent')::numeric, 0),
              COALESCE((v_summary->>'taxableAmount')::numeric, 0),
              COALESCE((v_summary->>'itemBaseAmount')::numeric, 0),
              COALESCE((v_summary->>'itemTaxAmount')::numeric, 0),
              COALESCE((v_summary->>'additionalChargeBaseAmount')::numeric, 0),
              COALESCE((v_summary->>'additionalChargeTaxAmount')::numeric, 0),
              COALESCE((v_summary->>'igstAmount')::numeric, 0),
              COALESCE((v_summary->>'cgstAmount')::numeric, 0),
              COALESCE((v_summary->>'sgstAmount')::numeric, 0),
              COALESCE((v_summary->>'finalAmount')::numeric, 0),
              COALESCE(v_summary->>'splitMode', 'CGST_SGST')::"public"."transaction_tax_split_mode_enum",
              now(),
              now()
            )
            ON CONFLICT (transaction_id) DO UPDATE SET
              tax_rate_percent = EXCLUDED.tax_rate_percent,
              taxable_amount = EXCLUDED.taxable_amount,
              item_base_amount = EXCLUDED.item_base_amount,
              item_tax_amount = EXCLUDED.item_tax_amount,
              additional_charge_base_amount = EXCLUDED.additional_charge_base_amount,
              additional_charge_tax_amount = EXCLUDED.additional_charge_tax_amount,
              igst_amount = EXCLUDED.igst_amount,
              cgst_amount = EXCLUDED.cgst_amount,
              sgst_amount = EXCLUDED.sgst_amount,
              final_amount = EXCLUDED.final_amount,
              split_mode = EXCLUDED.split_mode,
              updated_at = now();
          END;
          $$;
        `);

        await queryRunner.query(`
          CREATE OR REPLACE FUNCTION public.transaction_additional_charges_tax_fill_trigger()
          RETURNS trigger
          LANGUAGE plpgsql
          AS $$
          DECLARE
            v_tax_rate numeric := 0;
            v_apply_tax boolean := false;
          BEGIN
            SELECT
              COALESCE(t.tax_rate_percent, 0),
              COALESCE((t.party_profile_snapshot->>'applyTax')::boolean, false)
            INTO
              v_tax_rate,
              v_apply_tax
            FROM transactions t
            WHERE t.id = NEW.transaction_id;

            IF FOUND THEN
              NEW.gst_rate := ROUND(v_tax_rate, 4);
              NEW.gst_amount := CASE
                WHEN v_apply_tax THEN ROUND(COALESCE(NEW.amount, 0) * v_tax_rate / 100, 4)
                ELSE 0
              END;
            END IF;

            RETURN NEW;
          END;
          $$;
        `);

        await queryRunner.query(`
          CREATE OR REPLACE FUNCTION public.transaction_tax_summary_refresh_trigger()
          RETURNS trigger
          LANGUAGE plpgsql
          AS $$
          DECLARE
            v_transaction_id uuid;
          BEGIN
            IF TG_OP = 'DELETE' THEN
              v_transaction_id := OLD.transaction_id;
            ELSE
              v_transaction_id := NEW.transaction_id;
            END IF;

            PERFORM public.refresh_transaction_tax_summary(v_transaction_id);

            IF TG_OP = 'UPDATE' AND OLD.transaction_id IS DISTINCT FROM NEW.transaction_id THEN
              PERFORM public.refresh_transaction_tax_summary(OLD.transaction_id);
            END IF;

            RETURN NULL;
          END;
          $$;
        `);

        await queryRunner.query(
          `DROP TRIGGER IF EXISTS transaction_additional_charges_tax_fill_trigger ON "transaction_additional_charges"`,
        );
        await queryRunner.query(
          `CREATE TRIGGER transaction_additional_charges_tax_fill_trigger
           BEFORE INSERT OR UPDATE ON "transaction_additional_charges"
           FOR EACH ROW
           EXECUTE FUNCTION public.transaction_additional_charges_tax_fill_trigger()`,
        );

        await queryRunner.query(
          `DROP TRIGGER IF EXISTS transaction_items_tax_summary_refresh_trigger ON "transaction_items"`,
        );
        await queryRunner.query(
          `CREATE TRIGGER transaction_items_tax_summary_refresh_trigger
           AFTER INSERT OR UPDATE OR DELETE ON "transaction_items"
           FOR EACH ROW
           EXECUTE FUNCTION public.transaction_tax_summary_refresh_trigger()`,
        );

        await queryRunner.query(
          `DROP TRIGGER IF EXISTS transaction_additional_charges_tax_summary_refresh_trigger ON "transaction_additional_charges"`,
        );
        await queryRunner.query(
          `CREATE TRIGGER transaction_additional_charges_tax_summary_refresh_trigger
           AFTER INSERT OR UPDATE OR DELETE ON "transaction_additional_charges"
           FOR EACH ROW
           EXECUTE FUNCTION public.transaction_tax_summary_refresh_trigger()`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
          `DROP TRIGGER IF EXISTS transaction_additional_charges_tax_summary_refresh_trigger ON "transaction_additional_charges"`,
        );
        await queryRunner.query(
          `DROP TRIGGER IF EXISTS transaction_items_tax_summary_refresh_trigger ON "transaction_items"`,
        );
        await queryRunner.query(
          `DROP TRIGGER IF EXISTS transaction_additional_charges_tax_fill_trigger ON "transaction_additional_charges"`,
        );
        await queryRunner.query(
          `DROP FUNCTION IF EXISTS public.transaction_tax_summary_refresh_trigger()`,
        );
        await queryRunner.query(
          `DROP FUNCTION IF EXISTS public.transaction_additional_charges_tax_fill_trigger()`,
        );
        await queryRunner.query(
          `DROP FUNCTION IF EXISTS public.refresh_transaction_tax_summary(uuid)`,
        );
        await queryRunner.query(
          `DROP FUNCTION IF EXISTS public.calculate_transaction_gst_preview(jsonb)`,
        );
        await queryRunner.query(
          `DROP FUNCTION IF EXISTS public.calculate_transaction_gst_components(text, boolean, numeric, numeric, numeric, text, text)`,
        );
        await queryRunner.query(`DROP TABLE IF EXISTS "transaction_tax_summaries"`);
        await queryRunner.query(`
          DO $$
          BEGIN
            IF EXISTS (
              SELECT 1 FROM pg_type WHERE typname = 'transaction_tax_split_mode_enum'
            ) THEN
              DROP TYPE "public"."transaction_tax_split_mode_enum";
            END IF;
          END
          $$;
        `);
    }

}
