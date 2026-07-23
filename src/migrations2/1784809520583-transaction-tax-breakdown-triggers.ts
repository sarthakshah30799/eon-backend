import { MigrationInterface, QueryRunner } from "typeorm";

export class TransactionTaxBreakdownTriggers1784809520583 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
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
        v_item_taxable_amount numeric := 0;
        v_final_amount numeric := 0;
        v_split_mode text := NULL;
        v_igst numeric := 0;
        v_cgst numeric := 0;
        v_sgst numeric := 0;
        v_branch_state text := NULLIF(BTRIM(COALESCE(p_branch_state, '')), '');
        v_party_state text := NULLIF(BTRIM(COALESCE(p_party_state, '')), '');
        v_half_rate numeric := 0;
      BEGIN
        v_taxable_amount := ROUND(v_item_base + v_charge_base, 2);

        IF v_apply_tax THEN
          IF v_item_base <= 25000 THEN
            v_item_taxable_amount := 250;
          ELSIF v_item_base <= 100000 THEN
            v_item_taxable_amount := v_item_base * 0.01;
          ELSIF v_item_base < 1000000 THEN
            v_item_taxable_amount := 1000 + ((v_item_base - 100000) * 0.005);
          ELSE
            v_item_taxable_amount := 5500 + ((v_item_base - 1000000) * 0.001);
          END IF;

          v_item_taxable_amount := ROUND(COALESCE(v_item_taxable_amount, 0), 2);
          v_item_tax := ROUND(v_item_taxable_amount * v_tax_rate / 100, 2);
          v_charge_tax := ROUND(v_charge_base * v_tax_rate / 100, 2);
        END IF;

        v_total_tax := ROUND(v_item_tax + v_charge_tax, 2);

        IF v_apply_tax THEN
          IF v_branch_state IS NULL OR v_party_state IS NULL OR UPPER(v_branch_state) = UPPER(v_party_state) THEN
            v_split_mode := 'CGST_SGST';
          ELSE
            v_split_mode := 'IGST';
          END IF;
        END IF;

        IF v_total_tax > 0 THEN
          IF v_split_mode = 'IGST' THEN
            v_igst := v_total_tax;
          ELSE
            v_half_rate := v_tax_rate / 2.0;
            v_cgst := ROUND((v_item_taxable_amount * v_half_rate / 100) + (v_charge_base * v_half_rate / 100), 2);
            v_sgst := ROUND((v_item_taxable_amount * v_half_rate / 100) + (v_charge_base * v_half_rate / 100), 2);
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
          'itemTaxableAmount', ROUND(v_item_taxable_amount, 2),
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

        v_total_base := ROUND(v_item_base + v_charge_base, 2);
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
      CREATE OR REPLACE FUNCTION public.refresh_transaction_tax_breakdown(
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
        v_items jsonb;
        v_additional_charges jsonb;
        v_preview jsonb;
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
          jsonb_agg(
            jsonb_build_object(
              'quantity', ti.quantity,
              'rate', ti.rate,
              'per', ti.per
            )
            ORDER BY ti.line_no
          ),
          '[]'::jsonb
        )
        INTO v_items
        FROM transaction_items ti
        WHERE ti.transaction_id = p_transaction_id;

        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'amount', tac.amount,
              'applyTax', COALESCE(v_apply_tax, false)
            )
            ORDER BY tac.line_no
          ),
          '[]'::jsonb
        )
        INTO v_additional_charges
        FROM transaction_additional_charges tac
        WHERE tac.transaction_id = p_transaction_id;

        v_preview := public.calculate_transaction_gst_preview(
          jsonb_build_object(
            'transactionType', v_transaction_type,
            'partyProfileApplyTax', v_apply_tax,
            'taxRatePercent', v_tax_rate,
            'branchStateName', v_branch_state,
            'partyStateName', v_party_state,
            'items', COALESCE(v_items, '[]'::jsonb),
            'additionalCharges', COALESCE(v_additional_charges, '[]'::jsonb)
          )
        );

        UPDATE transactions
        SET
          tax_rate_percent = COALESCE((v_preview->>'taxRatePercent')::numeric, 0),
          taxable_amount = COALESCE((v_preview->>'taxableAmount')::numeric, 0),
          item_base_amount = COALESCE((v_preview->>'itemBaseAmount')::numeric, 0),
          item_taxable_amount = COALESCE((v_preview->>'itemTaxableAmount')::numeric, 0),
          item_tax_amount = COALESCE((v_preview->>'itemTaxAmount')::numeric, 0),
          additional_charge_base_amount = COALESCE((v_preview->>'additionalChargeBaseAmount')::numeric, 0),
          additional_charge_tax_amount = COALESCE((v_preview->>'additionalChargeTaxAmount')::numeric, 0),
          igst_amount = COALESCE((v_preview->>'igstAmount')::numeric, 0),
          cgst_amount = COALESCE((v_preview->>'cgstAmount')::numeric, 0),
          sgst_amount = COALESCE((v_preview->>'sgstAmount')::numeric, 0),
          final_amount = COALESCE((v_preview->>'finalAmount')::numeric, 0),
          split_mode = CASE
            WHEN COALESCE(v_preview->>'splitMode', '') = '' THEN NULL
            ELSE COALESCE(v_preview->>'splitMode', NULL)::"public"."transaction_tax_split_mode_enum"
          END,
          updated_at = now()
        WHERE id = p_transaction_id;

        UPDATE transaction_items ti
        SET
          taxable_amount = COALESCE(r.taxable_amount, 0),
          tax_rate_percent = COALESCE(r.tax_rate_percent, 0),
          gst_amount = COALESCE(r.gst_amount, 0),
          igst_rate_percent = COALESCE(r.igst_rate_percent, 0),
          cgst_rate_percent = COALESCE(r.cgst_rate_percent, 0),
          sgst_rate_percent = COALESCE(r.sgst_rate_percent, 0),
          igst_amount = COALESCE(r.igst_amount, 0),
          cgst_amount = COALESCE(r.cgst_amount, 0),
          sgst_amount = COALESCE(r.sgst_amount, 0),
          split_mode = CASE
            WHEN COALESCE(r.split_mode, '') = '' THEN NULL
            ELSE r.split_mode::"public"."transaction_tax_split_mode_enum"
          END,
          updated_at = now()
        FROM jsonb_to_recordset(COALESCE(v_preview->'itemRows', '[]'::jsonb)) AS r(
          line_no integer,
          taxable_amount numeric,
          tax_rate_percent numeric,
          gst_amount numeric,
          igst_rate_percent numeric,
          cgst_rate_percent numeric,
          sgst_rate_percent numeric,
          igst_amount numeric,
          cgst_amount numeric,
          sgst_amount numeric,
          split_mode text
        )
        WHERE ti.transaction_id = p_transaction_id
          AND ti.line_no = r.line_no;

        UPDATE transaction_additional_charges tac
        SET
          gst_rate = COALESCE(r.tax_rate_percent, 0),
          gst_amount = COALESCE(r.gst_amount, 0),
          tax_rate_percent = COALESCE(r.tax_rate_percent, 0),
          igst_rate_percent = COALESCE(r.igst_rate_percent, 0),
          cgst_rate_percent = COALESCE(r.cgst_rate_percent, 0),
          sgst_rate_percent = COALESCE(r.sgst_rate_percent, 0),
          igst_amount = COALESCE(r.igst_amount, 0),
          cgst_amount = COALESCE(r.cgst_amount, 0),
          sgst_amount = COALESCE(r.sgst_amount, 0),
          split_mode = CASE
            WHEN COALESCE(r.split_mode, '') = '' THEN NULL
            ELSE r.split_mode::"public"."transaction_tax_split_mode_enum"
          END,
          updated_at = now()
        FROM jsonb_to_recordset(COALESCE(v_preview->'additionalChargeRows', '[]'::jsonb)) AS r(
          line_no integer,
          amount numeric,
          tax_rate_percent numeric,
          gst_rate_percent numeric,
          gst_amount numeric,
          igst_amount numeric,
          cgst_amount numeric,
          sgst_amount numeric,
          igst_rate_percent numeric,
          cgst_rate_percent numeric,
          sgst_rate_percent numeric,
          split_mode text,
          total_amount numeric
        )
        WHERE tac.transaction_id = p_transaction_id
          AND tac.line_no = r.line_no;
      END;
      $$;
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.transaction_header_tax_breakdown_refresh_trigger()
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

        PERFORM public.refresh_transaction_tax_breakdown(v_transaction_id);
        RETURN NULL;
      END;
      $$;
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.transaction_child_tax_breakdown_refresh_trigger()
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

        PERFORM public.refresh_transaction_tax_breakdown(v_transaction_id);

        IF TG_OP = 'UPDATE' AND OLD.transaction_id IS DISTINCT FROM NEW.transaction_id THEN
          PERFORM public.refresh_transaction_tax_breakdown(OLD.transaction_id);
        END IF;

        RETURN NULL;
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
      DROP TRIGGER IF EXISTS transaction_items_tax_breakdown_refresh_trigger ON "transaction_items"
    `);
    await queryRunner.query(`
      CREATE TRIGGER transaction_items_tax_breakdown_refresh_trigger
      AFTER INSERT OR UPDATE OR DELETE ON "transaction_items"
      FOR EACH ROW
      EXECUTE FUNCTION public.transaction_child_tax_breakdown_refresh_trigger()
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS transaction_additional_charges_tax_breakdown_refresh_trigger ON "transaction_additional_charges"
    `);
    await queryRunner.query(`
      CREATE TRIGGER transaction_additional_charges_tax_breakdown_refresh_trigger
      AFTER INSERT OR UPDATE OR DELETE ON "transaction_additional_charges"
      FOR EACH ROW
      EXECUTE FUNCTION public.transaction_child_tax_breakdown_refresh_trigger()
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS transaction_header_tax_breakdown_refresh_trigger ON "transactions"
    `);
    await queryRunner.query(`
      CREATE TRIGGER transaction_header_tax_breakdown_refresh_trigger
      AFTER INSERT OR UPDATE OF transaction_type, tax_rate_percent, branch_snapshot, party_profile_snapshot ON "transactions"
      FOR EACH ROW
      EXECUTE FUNCTION public.transaction_header_tax_breakdown_refresh_trigger()
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS transaction_additional_charges_tax_fill_trigger ON "transaction_additional_charges"
    `);
    await queryRunner.query(`
      CREATE TRIGGER transaction_additional_charges_tax_fill_trigger
      BEFORE INSERT OR UPDATE ON "transaction_additional_charges"
      FOR EACH ROW
      EXECUTE FUNCTION public.transaction_additional_charges_tax_fill_trigger()
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
          PERFORM public.refresh_transaction_tax_breakdown(v_transaction_id);
        END LOOP;
      END
      $$;
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS transaction_header_tax_summary_refresh_trigger ON "transactions"
    `);
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS transaction_additional_charges_tax_summary_refresh_trigger ON "transaction_additional_charges"
    `);
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS transaction_items_tax_summary_refresh_trigger ON "transaction_items"
    `);
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS public.transaction_tax_summary_refresh_trigger()
    `);
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS public.refresh_transaction_tax_summary(uuid)
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "transaction_tax_summaries"
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'transaction_tax_summaries_split_mode_enum'
        ) THEN
          DROP TYPE "public"."transaction_tax_summaries_split_mode_enum";
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS transaction_header_tax_breakdown_refresh_trigger ON "transactions"
    `);
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS transaction_additional_charges_tax_breakdown_refresh_trigger ON "transaction_additional_charges"
    `);
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS transaction_items_tax_breakdown_refresh_trigger ON "transaction_items"
    `);
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS transaction_additional_charges_tax_fill_trigger ON "transaction_additional_charges"
    `);
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS public.transaction_header_tax_breakdown_refresh_trigger()
    `);
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS public.transaction_child_tax_breakdown_refresh_trigger()
    `);
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS public.transaction_additional_charges_tax_fill_trigger()
    `);
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS public.refresh_transaction_tax_breakdown(uuid)
    `);
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS public.calculate_transaction_gst_preview(jsonb)
    `);
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS public.calculate_transaction_gst_components(text, boolean, numeric, numeric, numeric, text, text)
    `);
  }
}
