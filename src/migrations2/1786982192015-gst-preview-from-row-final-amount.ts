import { MigrationInterface, QueryRunner } from "typeorm";

export class GstPreviewFromRowFinalAmount1786982192015 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.calculate_transaction_item_final_amount(
        p_item jsonb
      )
      RETURNS numeric
      LANGUAGE plpgsql
      IMMUTABLE
      AS $$
      DECLARE
        v_explicit numeric;
        v_quantity numeric;
        v_rate numeric;
        v_per numeric;
      BEGIN
        v_explicit := NULLIF(BTRIM(COALESCE(p_item->>'finalAmount', '')), '')::numeric;
        IF v_explicit IS NOT NULL THEN
          RETURN ROUND(v_explicit, 2);
        END IF;

        v_quantity := COALESCE(NULLIF(BTRIM(COALESCE(p_item->>'quantity', '')), '')::numeric, 0);
        v_rate := COALESCE(NULLIF(BTRIM(COALESCE(p_item->>'rate', '')), '')::numeric, 0);
        v_per := COALESCE(NULLIF(NULLIF(BTRIM(COALESCE(p_item->>'per', '')), '')::numeric, 0), 1);

        RETURN ROUND(ROUND(v_quantity * v_rate / v_per, 2), 0);
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
        v_apply_tax boolean := COALESCE(NULLIF(BTRIM(COALESCE(p_payload->>'partyProfileApplyTax', '')), '')::boolean, false);
        v_tax_rate numeric := COALESCE(NULLIF(BTRIM(COALESCE(p_payload->>'taxRatePercent', '')), '')::numeric, 0);
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
        v_items jsonb := COALESCE(p_payload->'items', '[]'::jsonb);
        v_additional_charges jsonb := COALESCE(p_payload->'additionalCharges', '[]'::jsonb);
        v_item_base numeric := 0;
        v_charge_base numeric := 0;
        v_item_taxable numeric := 0;
        v_item_tax numeric := 0;
        v_additional_charge_tax numeric := 0;
        v_item_igst_amount numeric := 0;
        v_item_cgst_amount numeric := 0;
        v_item_sgst_amount numeric := 0;
        v_additional_charge_igst_amount numeric := 0;
        v_additional_charge_cgst_amount numeric := 0;
        v_additional_charge_sgst_amount numeric := 0;
        v_igst_amount numeric := 0;
        v_cgst_amount numeric := 0;
        v_sgst_amount numeric := 0;
        v_split_mode text := NULL;
        v_half_rate numeric := 0;
        v_item jsonb;
        v_charge jsonb;
        v_item_rows jsonb := '[]'::jsonb;
        v_charge_rows jsonb := '[]'::jsonb;
        v_row_base numeric := 0;
        v_row_taxable numeric := 0;
        v_row_tax numeric := 0;
        v_row_igst numeric := 0;
        v_row_cgst numeric := 0;
        v_row_sgst numeric := 0;
        v_row_charge_amount numeric := 0;
        v_row_charge_tax numeric := 0;
        v_row_charge_igst numeric := 0;
        v_row_charge_cgst numeric := 0;
        v_row_charge_sgst numeric := 0;
        v_row_split_mode text := NULL;
        v_row_applies_tax boolean := false;
        v_total_base numeric := 0;
        v_final_amount numeric := 0;
        v_item_count integer := COALESCE(jsonb_array_length(v_items), 0);
        v_item_index integer := 0;
      BEGIN
        FOR v_item IN
          SELECT value
          FROM jsonb_array_elements(v_items) AS value
        LOOP
          v_item_base := v_item_base + public.calculate_transaction_item_final_amount(v_item);
        END LOOP;

        FOR v_charge IN
          SELECT value
          FROM jsonb_array_elements(v_additional_charges) AS value
        LOOP
          v_charge_base := v_charge_base + ROUND(COALESCE(NULLIF(BTRIM(COALESCE(v_charge->>'amount', '')), '')::numeric, 0), 2);
        END LOOP;

        IF v_apply_tax THEN
          v_item_taxable := CASE
            WHEN v_item_base <= 25000 THEN 250
            WHEN v_item_base > 25000 AND v_item_base <= 100000 THEN v_item_base * 0.01
            WHEN v_item_base > 100000 AND v_item_base < 1000000 THEN 1000 + ((v_item_base - 100000) * 0.005)
            ELSE 5500 + ((v_item_base - 1000000) * 0.001)
          END;
          v_item_taxable := ROUND(COALESCE(v_item_taxable, 0), 2);
          v_item_tax := ROUND(v_item_taxable * v_tax_rate / 100, 2);

          IF v_branch_state IS NULL OR v_party_state IS NULL OR UPPER(v_branch_state) = UPPER(v_party_state) THEN
            v_split_mode := 'CGST_SGST';
          ELSE
            v_split_mode := 'IGST';
          END IF;

          IF v_split_mode = 'IGST' THEN
            v_item_igst_amount := v_item_tax;
          ELSE
            v_half_rate := v_tax_rate / 2.0;
            v_item_cgst_amount := ROUND(v_item_taxable * v_half_rate / 100, 2);
            v_item_sgst_amount := ROUND(v_item_taxable * v_half_rate / 100, 2);
          END IF;
        END IF;

        v_item_index := 0;
        FOR v_item IN
          SELECT value
          FROM jsonb_array_elements(v_items) AS value
        LOOP
          v_item_index := v_item_index + 1;
          v_row_base := public.calculate_transaction_item_final_amount(v_item);
          v_row_taxable := CASE WHEN v_apply_tax THEN v_row_base ELSE 0 END;
          v_row_tax := CASE WHEN v_apply_tax THEN ROUND(v_row_taxable * v_tax_rate / 100, 2) ELSE 0 END;

          IF v_apply_tax AND v_split_mode = 'IGST' THEN
            v_row_igst := v_row_tax;
            v_row_cgst := 0;
            v_row_sgst := 0;
            v_row_split_mode := 'IGST';
          ELSIF v_apply_tax THEN
            v_row_igst := 0;
            v_row_cgst := ROUND(v_row_taxable * (v_tax_rate / 2.0) / 100, 2);
            v_row_sgst := ROUND(v_row_taxable * (v_tax_rate / 2.0) / 100, 2);
            v_row_split_mode := 'CGST_SGST';
          ELSE
            v_row_igst := 0;
            v_row_cgst := 0;
            v_row_sgst := 0;
            v_row_split_mode := NULL;
          END IF;

          v_item_rows := v_item_rows || jsonb_build_array(
            jsonb_build_object(
              'lineNo', v_item_index,
              'taxableAmount', ROUND(v_row_taxable, 2),
              'taxRatePercent', ROUND(COALESCE(v_tax_rate, 0), 4),
              'gstAmount', ROUND(v_row_tax, 2),
              'igstRatePercent', CASE WHEN v_row_split_mode = 'IGST' THEN ROUND(v_tax_rate, 4) ELSE 0 END,
              'cgstRatePercent', CASE WHEN v_row_split_mode = 'CGST_SGST' THEN ROUND(v_tax_rate / 2.0, 4) ELSE 0 END,
              'sgstRatePercent', CASE WHEN v_row_split_mode = 'CGST_SGST' THEN ROUND(v_tax_rate / 2.0, 4) ELSE 0 END,
              'igstAmount', ROUND(v_row_igst, 2),
              'cgstAmount', ROUND(v_row_cgst, 2),
              'sgstAmount', ROUND(v_row_sgst, 2),
              'splitMode', v_row_split_mode
            )
          );
        END LOOP;

        FOR v_charge IN
          SELECT value
          FROM jsonb_array_elements(v_additional_charges) AS value
        LOOP
          v_row_charge_amount := ROUND(COALESCE(NULLIF(BTRIM(COALESCE(v_charge->>'amount', '')), '')::numeric, 0), 2);
          v_row_applies_tax := v_apply_tax AND COALESCE(NULLIF(BTRIM(COALESCE(v_charge->>'applyTax', '')), '')::boolean, false);
          v_row_charge_tax := CASE
            WHEN v_row_applies_tax THEN ROUND(v_row_charge_amount * v_tax_rate / 100, 2)
            ELSE 0
          END;

          IF v_row_applies_tax AND v_split_mode = 'IGST' THEN
            v_row_charge_igst := v_row_charge_tax;
            v_row_charge_cgst := 0;
            v_row_charge_sgst := 0;
            v_row_split_mode := 'IGST';
          ELSIF v_row_applies_tax THEN
            v_row_charge_igst := 0;
            v_row_charge_cgst := ROUND(v_row_charge_amount * (v_tax_rate / 2.0) / 100, 2);
            v_row_charge_sgst := ROUND(v_row_charge_amount * (v_tax_rate / 2.0) / 100, 2);
            v_row_split_mode := 'CGST_SGST';
          ELSE
            v_row_charge_igst := 0;
            v_row_charge_cgst := 0;
            v_row_charge_sgst := 0;
            v_row_split_mode := NULL;
          END IF;

          v_additional_charge_tax := v_additional_charge_tax + v_row_charge_tax;
          v_additional_charge_igst_amount := v_additional_charge_igst_amount + v_row_charge_igst;
          v_additional_charge_cgst_amount := v_additional_charge_cgst_amount + v_row_charge_cgst;
          v_additional_charge_sgst_amount := v_additional_charge_sgst_amount + v_row_charge_sgst;

          v_charge_rows := v_charge_rows || jsonb_build_array(
            jsonb_build_object(
              'lineNo', COALESCE((v_charge->>'lineNo')::integer, jsonb_array_length(v_charge_rows) + 1),
              'amount', ROUND(v_row_charge_amount, 2),
              'taxRatePercent', CASE WHEN v_row_applies_tax THEN ROUND(v_tax_rate, 4) ELSE 0 END,
              'gstRatePercent', CASE WHEN v_row_applies_tax THEN ROUND(v_tax_rate, 4) ELSE 0 END,
              'gstAmount', ROUND(v_row_charge_tax, 2),
              'igstAmount', ROUND(v_row_charge_igst, 2),
              'cgstAmount', ROUND(v_row_charge_cgst, 2),
              'sgstAmount', ROUND(v_row_charge_sgst, 2),
              'igstRatePercent', CASE WHEN v_row_applies_tax AND v_row_split_mode = 'IGST' THEN ROUND(v_tax_rate, 4) ELSE 0 END,
              'cgstRatePercent', CASE WHEN v_row_applies_tax AND v_row_split_mode = 'CGST_SGST' THEN ROUND(v_tax_rate / 2.0, 4) ELSE 0 END,
              'sgstRatePercent', CASE WHEN v_row_applies_tax AND v_row_split_mode = 'CGST_SGST' THEN ROUND(v_tax_rate / 2.0, 4) ELSE 0 END,
              'splitMode', v_row_split_mode,
              'totalAmount', CASE
                WHEN UPPER(v_transaction_type) = 'PURCHASE' THEN ROUND(-(v_row_charge_amount + v_row_charge_tax), 2)
                ELSE ROUND(v_row_charge_amount + v_row_charge_tax, 2)
              END
            )
          );
        END LOOP;

        v_total_base := ROUND(CASE WHEN v_transaction_type = 'PURCHASE' THEN v_item_base - v_charge_base ELSE v_item_base + v_charge_base END, 2);
        v_igst_amount := ROUND(v_item_igst_amount + v_additional_charge_igst_amount, 2);
        v_cgst_amount := ROUND(v_item_cgst_amount + v_additional_charge_cgst_amount, 2);
        v_sgst_amount := ROUND(v_item_sgst_amount + v_additional_charge_sgst_amount, 2);

        IF v_apply_tax THEN
          IF v_split_mode = 'IGST' THEN
            v_igst_amount := ROUND(v_item_igst_amount + v_additional_charge_igst_amount, 2);
            v_cgst_amount := 0;
            v_sgst_amount := 0;
          ELSE
            v_igst_amount := 0;
            v_cgst_amount := ROUND(v_item_cgst_amount + v_additional_charge_cgst_amount, 2);
            v_sgst_amount := ROUND(v_item_sgst_amount + v_additional_charge_sgst_amount, 2);
          END IF;
        ELSE
          v_split_mode := NULL;
          v_igst_amount := 0;
          v_cgst_amount := 0;
          v_sgst_amount := 0;
        END IF;

        IF UPPER(v_transaction_type) = 'PURCHASE' THEN
          v_final_amount := ROUND(v_total_base - (v_item_tax + v_additional_charge_tax), 2);
        ELSE
          v_final_amount := ROUND(v_total_base + (v_item_tax + v_additional_charge_tax), 2);
        END IF;

        RETURN jsonb_build_object(
          'transactionType', v_transaction_type,
          'applyTax', v_apply_tax,
          'taxRatePercent', ROUND(v_tax_rate, 4),
          'taxableAmount', ROUND(v_total_base, 2),
          'itemBaseAmount', ROUND(v_item_base, 2),
          'itemTaxableAmount', ROUND(v_item_taxable, 2),
          'itemTaxAmount', ROUND(v_item_tax, 2),
          'itemIgstAmount', ROUND(v_item_igst_amount, 2),
          'itemCgstAmount', ROUND(v_item_cgst_amount, 2),
          'itemSgstAmount', ROUND(v_item_sgst_amount, 2),
          'itemIgstRatePercent', CASE WHEN v_apply_tax AND v_split_mode = 'IGST' THEN ROUND(v_tax_rate, 4) ELSE 0 END,
          'itemCgstRatePercent', CASE WHEN v_apply_tax AND v_split_mode = 'CGST_SGST' THEN ROUND(v_tax_rate / 2.0, 4) ELSE 0 END,
          'itemSgstRatePercent', CASE WHEN v_apply_tax AND v_split_mode = 'CGST_SGST' THEN ROUND(v_tax_rate / 2.0, 4) ELSE 0 END,
          'additionalChargeBaseAmount', ROUND(v_charge_base, 2),
          'additionalChargeTaxAmount', ROUND(v_additional_charge_tax, 2),
          'totalTaxAmount', ROUND(v_item_tax + v_additional_charge_tax, 2),
          'finalAmount', ROUND(v_final_amount, 2),
          'igstAmount', ROUND(v_igst_amount, 2),
          'cgstAmount', ROUND(v_cgst_amount, 2),
          'sgstAmount', ROUND(v_sgst_amount, 2),
          'splitMode', v_split_mode,
          'branchStateName', v_branch_state,
          'partyStateName', v_party_state,
          'itemRows', COALESCE(v_item_rows, '[]'::jsonb),
          'additionalChargeRows', COALESCE(v_charge_rows, '[]'::jsonb)
        );
      END;
      $$;
    `);

    await queryRunner.query(`
      DO $$
      DECLARE
        v_transaction_id uuid;
      BEGIN
        ALTER TABLE transaction_items DISABLE TRIGGER "TRG_card_stock_transaction_item_ledger";

        UPDATE transaction_items
        SET
          round_off = CASE
            WHEN quantity IS NULL OR rate IS NULL THEN NULL
            ELSE ROUND(
              ROUND(quantity * rate / COALESCE(NULLIF(per, 0), 1), 0)
              - ROUND(quantity * rate / COALESCE(NULLIF(per, 0), 1), 2)
            , 2)
          END,
          updated_at = now()
        WHERE deleted_at IS NULL;

        FOR v_transaction_id IN
          SELECT id
          FROM transactions
          WHERE deleted_at IS NULL
        LOOP
          PERFORM public.refresh_transaction_tax_breakdown(v_transaction_id);
          PERFORM public.refresh_transaction_tcs(v_transaction_id);
        END LOOP;

        ALTER TABLE transaction_items ENABLE TRIGGER "TRG_card_stock_transaction_item_ledger";
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.calculate_transaction_gst_preview(
        p_payload jsonb
      )
      RETURNS jsonb
      LANGUAGE plpgsql
      AS $$
      DECLARE
        v_transaction_type text := COALESCE(p_payload->>'transactionType', '');
        v_apply_tax boolean := COALESCE(NULLIF(BTRIM(COALESCE(p_payload->>'partyProfileApplyTax', '')), '')::boolean, false);
        v_tax_rate numeric := COALESCE(NULLIF(BTRIM(COALESCE(p_payload->>'taxRatePercent', '')), '')::numeric, 0);
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
        v_items jsonb := COALESCE(p_payload->'items', '[]'::jsonb);
        v_additional_charges jsonb := COALESCE(p_payload->'additionalCharges', '[]'::jsonb);
        v_item_base numeric := 0;
        v_charge_base numeric := 0;
        v_item_taxable numeric := 0;
        v_item_tax numeric := 0;
        v_additional_charge_tax numeric := 0;
        v_item_igst_amount numeric := 0;
        v_item_cgst_amount numeric := 0;
        v_item_sgst_amount numeric := 0;
        v_additional_charge_igst_amount numeric := 0;
        v_additional_charge_cgst_amount numeric := 0;
        v_additional_charge_sgst_amount numeric := 0;
        v_igst_amount numeric := 0;
        v_cgst_amount numeric := 0;
        v_sgst_amount numeric := 0;
        v_split_mode text := NULL;
        v_half_rate numeric := 0;
        v_item jsonb;
        v_charge jsonb;
        v_item_rows jsonb := '[]'::jsonb;
        v_charge_rows jsonb := '[]'::jsonb;
        v_row_base numeric := 0;
        v_row_taxable numeric := 0;
        v_row_tax numeric := 0;
        v_row_igst numeric := 0;
        v_row_cgst numeric := 0;
        v_row_sgst numeric := 0;
        v_row_charge_amount numeric := 0;
        v_row_charge_tax numeric := 0;
        v_row_charge_igst numeric := 0;
        v_row_charge_cgst numeric := 0;
        v_row_charge_sgst numeric := 0;
        v_row_split_mode text := NULL;
        v_row_applies_tax boolean := false;
        v_total_base numeric := 0;
        v_final_amount numeric := 0;
        v_item_count integer := COALESCE(jsonb_array_length(v_items), 0);
        v_item_index integer := 0;
      BEGIN
        FOR v_item IN
          SELECT value
          FROM jsonb_array_elements(v_items) AS value
        LOOP
          v_item_base := v_item_base + ROUND(
            COALESCE(NULLIF(BTRIM(COALESCE(v_item->>'quantity', '')), '')::numeric, 0)
            * COALESCE(NULLIF(BTRIM(COALESCE(v_item->>'rate', '')), '')::numeric, 0)
            / COALESCE(NULLIF(NULLIF(BTRIM(COALESCE(v_item->>'per', '')), '')::numeric, 0), 1),
            2
          );
        END LOOP;

        FOR v_charge IN
          SELECT value
          FROM jsonb_array_elements(v_additional_charges) AS value
        LOOP
          v_charge_base := v_charge_base + ROUND(COALESCE(NULLIF(BTRIM(COALESCE(v_charge->>'amount', '')), '')::numeric, 0), 2);
        END LOOP;

        IF v_apply_tax THEN
          v_item_taxable := CASE
            WHEN v_item_base <= 25000 THEN 250
            WHEN v_item_base > 25000 AND v_item_base <= 100000 THEN v_item_base * 0.01
            WHEN v_item_base > 100000 AND v_item_base < 1000000 THEN 1000 + ((v_item_base - 100000) * 0.005)
            ELSE 5500 + ((v_item_base - 1000000) * 0.001)
          END;
          v_item_taxable := ROUND(COALESCE(v_item_taxable, 0), 2);
          v_item_tax := ROUND(v_item_taxable * v_tax_rate / 100, 2);

          IF v_branch_state IS NULL OR v_party_state IS NULL OR UPPER(v_branch_state) = UPPER(v_party_state) THEN
            v_split_mode := 'CGST_SGST';
          ELSE
            v_split_mode := 'IGST';
          END IF;

          IF v_split_mode = 'IGST' THEN
            v_item_igst_amount := v_item_tax;
          ELSE
            v_half_rate := v_tax_rate / 2.0;
            v_item_cgst_amount := ROUND(v_item_taxable * v_half_rate / 100, 2);
            v_item_sgst_amount := ROUND(v_item_taxable * v_half_rate / 100, 2);
          END IF;
        END IF;

        v_item_index := 0;
        FOR v_item IN
          SELECT value
          FROM jsonb_array_elements(v_items) AS value
        LOOP
          v_item_index := v_item_index + 1;
          v_row_base := ROUND(
            COALESCE(NULLIF(BTRIM(COALESCE(v_item->>'quantity', '')), '')::numeric, 0)
            * COALESCE(NULLIF(BTRIM(COALESCE(v_item->>'rate', '')), '')::numeric, 0)
            / COALESCE(NULLIF(NULLIF(BTRIM(COALESCE(v_item->>'per', '')), '')::numeric, 0), 1),
            2
          );
          v_row_taxable := CASE WHEN v_apply_tax THEN v_row_base ELSE 0 END;
          v_row_tax := CASE WHEN v_apply_tax THEN ROUND(v_row_taxable * v_tax_rate / 100, 2) ELSE 0 END;

          IF v_apply_tax AND v_split_mode = 'IGST' THEN
            v_row_igst := v_row_tax;
            v_row_cgst := 0;
            v_row_sgst := 0;
            v_row_split_mode := 'IGST';
          ELSIF v_apply_tax THEN
            v_row_igst := 0;
            v_row_cgst := ROUND(v_row_taxable * (v_tax_rate / 2.0) / 100, 2);
            v_row_sgst := ROUND(v_row_taxable * (v_tax_rate / 2.0) / 100, 2);
            v_row_split_mode := 'CGST_SGST';
          ELSE
            v_row_igst := 0;
            v_row_cgst := 0;
            v_row_sgst := 0;
            v_row_split_mode := NULL;
          END IF;

          v_item_rows := v_item_rows || jsonb_build_array(
            jsonb_build_object(
              'lineNo', v_item_index,
              'taxableAmount', ROUND(v_row_taxable, 2),
              'taxRatePercent', ROUND(COALESCE(v_tax_rate, 0), 4),
              'gstAmount', ROUND(v_row_tax, 2),
              'igstRatePercent', CASE WHEN v_row_split_mode = 'IGST' THEN ROUND(v_tax_rate, 4) ELSE 0 END,
              'cgstRatePercent', CASE WHEN v_row_split_mode = 'CGST_SGST' THEN ROUND(v_tax_rate / 2.0, 4) ELSE 0 END,
              'sgstRatePercent', CASE WHEN v_row_split_mode = 'CGST_SGST' THEN ROUND(v_tax_rate / 2.0, 4) ELSE 0 END,
              'igstAmount', ROUND(v_row_igst, 2),
              'cgstAmount', ROUND(v_row_cgst, 2),
              'sgstAmount', ROUND(v_row_sgst, 2),
              'splitMode', v_row_split_mode
            )
          );
        END LOOP;

        FOR v_charge IN
          SELECT value
          FROM jsonb_array_elements(v_additional_charges) AS value
        LOOP
          v_row_charge_amount := ROUND(COALESCE(NULLIF(BTRIM(COALESCE(v_charge->>'amount', '')), '')::numeric, 0), 2);
          v_row_applies_tax := v_apply_tax AND COALESCE(NULLIF(BTRIM(COALESCE(v_charge->>'applyTax', '')), '')::boolean, false);
          v_row_charge_tax := CASE
            WHEN v_row_applies_tax THEN ROUND(v_row_charge_amount * v_tax_rate / 100, 2)
            ELSE 0
          END;

          IF v_row_applies_tax AND v_split_mode = 'IGST' THEN
            v_row_charge_igst := v_row_charge_tax;
            v_row_charge_cgst := 0;
            v_row_charge_sgst := 0;
            v_row_split_mode := 'IGST';
          ELSIF v_row_applies_tax THEN
            v_row_charge_igst := 0;
            v_row_charge_cgst := ROUND(v_row_charge_amount * (v_tax_rate / 2.0) / 100, 2);
            v_row_charge_sgst := ROUND(v_row_charge_amount * (v_tax_rate / 2.0) / 100, 2);
            v_row_split_mode := 'CGST_SGST';
          ELSE
            v_row_charge_igst := 0;
            v_row_charge_cgst := 0;
            v_row_charge_sgst := 0;
            v_row_split_mode := NULL;
          END IF;

          v_additional_charge_tax := v_additional_charge_tax + v_row_charge_tax;
          v_additional_charge_igst_amount := v_additional_charge_igst_amount + v_row_charge_igst;
          v_additional_charge_cgst_amount := v_additional_charge_cgst_amount + v_row_charge_cgst;
          v_additional_charge_sgst_amount := v_additional_charge_sgst_amount + v_row_charge_sgst;

          v_charge_rows := v_charge_rows || jsonb_build_array(
            jsonb_build_object(
              'lineNo', COALESCE((v_charge->>'lineNo')::integer, jsonb_array_length(v_charge_rows) + 1),
              'amount', ROUND(v_row_charge_amount, 2),
              'taxRatePercent', CASE WHEN v_row_applies_tax THEN ROUND(v_tax_rate, 4) ELSE 0 END,
              'gstRatePercent', CASE WHEN v_row_applies_tax THEN ROUND(v_tax_rate, 4) ELSE 0 END,
              'gstAmount', ROUND(v_row_charge_tax, 2),
              'igstAmount', ROUND(v_row_charge_igst, 2),
              'cgstAmount', ROUND(v_row_charge_cgst, 2),
              'sgstAmount', ROUND(v_row_charge_sgst, 2),
              'igstRatePercent', CASE WHEN v_row_applies_tax AND v_row_split_mode = 'IGST' THEN ROUND(v_tax_rate, 4) ELSE 0 END,
              'cgstRatePercent', CASE WHEN v_row_applies_tax AND v_row_split_mode = 'CGST_SGST' THEN ROUND(v_tax_rate / 2.0, 4) ELSE 0 END,
              'sgstRatePercent', CASE WHEN v_row_applies_tax AND v_row_split_mode = 'CGST_SGST' THEN ROUND(v_tax_rate / 2.0, 4) ELSE 0 END,
              'splitMode', v_row_split_mode,
              'totalAmount', CASE
                WHEN UPPER(v_transaction_type) = 'PURCHASE' THEN ROUND(-(v_row_charge_amount + v_row_charge_tax), 2)
                ELSE ROUND(v_row_charge_amount + v_row_charge_tax, 2)
              END
            )
          );
        END LOOP;

        v_total_base := ROUND(CASE WHEN v_transaction_type = 'PURCHASE' THEN v_item_base - v_charge_base ELSE v_item_base + v_charge_base END, 2);
        v_igst_amount := ROUND(v_item_igst_amount + v_additional_charge_igst_amount, 2);
        v_cgst_amount := ROUND(v_item_cgst_amount + v_additional_charge_cgst_amount, 2);
        v_sgst_amount := ROUND(v_item_sgst_amount + v_additional_charge_sgst_amount, 2);

        IF v_apply_tax THEN
          IF v_split_mode = 'IGST' THEN
            v_igst_amount := ROUND(v_item_igst_amount + v_additional_charge_igst_amount, 2);
            v_cgst_amount := 0;
            v_sgst_amount := 0;
          ELSE
            v_igst_amount := 0;
            v_cgst_amount := ROUND(v_item_cgst_amount + v_additional_charge_cgst_amount, 2);
            v_sgst_amount := ROUND(v_item_sgst_amount + v_additional_charge_sgst_amount, 2);
          END IF;
        ELSE
          v_split_mode := NULL;
          v_igst_amount := 0;
          v_cgst_amount := 0;
          v_sgst_amount := 0;
        END IF;

        IF UPPER(v_transaction_type) = 'PURCHASE' THEN
          v_final_amount := ROUND(v_total_base - (v_item_tax + v_additional_charge_tax), 2);
        ELSE
          v_final_amount := ROUND(v_total_base + (v_item_tax + v_additional_charge_tax), 2);
        END IF;

        RETURN jsonb_build_object(
          'transactionType', v_transaction_type,
          'applyTax', v_apply_tax,
          'taxRatePercent', ROUND(v_tax_rate, 4),
          'taxableAmount', ROUND(v_total_base, 2),
          'itemBaseAmount', ROUND(v_item_base, 2),
          'itemTaxableAmount', ROUND(v_item_taxable, 2),
          'itemTaxAmount', ROUND(v_item_tax, 2),
          'itemIgstAmount', ROUND(v_item_igst_amount, 2),
          'itemCgstAmount', ROUND(v_item_cgst_amount, 2),
          'itemSgstAmount', ROUND(v_item_sgst_amount, 2),
          'itemIgstRatePercent', CASE WHEN v_apply_tax AND v_split_mode = 'IGST' THEN ROUND(v_tax_rate, 4) ELSE 0 END,
          'itemCgstRatePercent', CASE WHEN v_apply_tax AND v_split_mode = 'CGST_SGST' THEN ROUND(v_tax_rate / 2.0, 4) ELSE 0 END,
          'itemSgstRatePercent', CASE WHEN v_apply_tax AND v_split_mode = 'CGST_SGST' THEN ROUND(v_tax_rate / 2.0, 4) ELSE 0 END,
          'additionalChargeBaseAmount', ROUND(v_charge_base, 2),
          'additionalChargeTaxAmount', ROUND(v_additional_charge_tax, 2),
          'totalTaxAmount', ROUND(v_item_tax + v_additional_charge_tax, 2),
          'finalAmount', ROUND(v_final_amount, 2),
          'igstAmount', ROUND(v_igst_amount, 2),
          'cgstAmount', ROUND(v_cgst_amount, 2),
          'sgstAmount', ROUND(v_sgst_amount, 2),
          'splitMode', v_split_mode,
          'branchStateName', v_branch_state,
          'partyStateName', v_party_state,
          'itemRows', COALESCE(v_item_rows, '[]'::jsonb),
          'additionalChargeRows', COALESCE(v_charge_rows, '[]'::jsonb)
        );
      END;
      $$;
    `);

    await queryRunner.query(`
      DO $$
      DECLARE
        v_transaction_id uuid;
      BEGIN
        ALTER TABLE transaction_items DISABLE TRIGGER "TRG_card_stock_transaction_item_ledger";

        UPDATE transaction_items
        SET
          round_off = CASE
            WHEN quantity IS NULL OR rate IS NULL THEN NULL
            ELSE ROUND(ROUND(quantity * rate, 0) - (quantity * rate), 2)
          END,
          updated_at = now()
        WHERE deleted_at IS NULL;

        FOR v_transaction_id IN
          SELECT id
          FROM transactions
          WHERE deleted_at IS NULL
        LOOP
          PERFORM public.refresh_transaction_tax_breakdown(v_transaction_id);
          PERFORM public.refresh_transaction_tcs(v_transaction_id);
        END LOOP;

        ALTER TABLE transaction_items ENABLE TRIGGER "TRG_card_stock_transaction_item_ledger";
      END
      $$;
    `);

    await queryRunner.query(`
      DROP FUNCTION IF EXISTS public.calculate_transaction_item_final_amount(jsonb)
    `);
  }
}
