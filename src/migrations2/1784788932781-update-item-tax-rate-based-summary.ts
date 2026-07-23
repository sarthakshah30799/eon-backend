import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateItemTaxRateBasedSummary1784788932781
  implements MigrationInterface
{
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
        v_split_mode text := 'CGST_SGST';
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

        IF v_branch_state IS NULL OR v_party_state IS NULL OR UPPER(v_branch_state) = UPPER(v_party_state) THEN
          v_split_mode := 'CGST_SGST';
        ELSE
          v_split_mode := 'IGST';
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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
        v_split_mode text := 'CGST_SGST';
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

        IF v_branch_state IS NULL OR v_party_state IS NULL OR UPPER(v_branch_state) = UPPER(v_party_state) THEN
          v_split_mode := 'CGST_SGST';
        ELSE
          v_split_mode := 'IGST';
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
  }
}
