import { MigrationInterface, QueryRunner } from "typeorm";

export class TransactionTaxBreakdownSchema1784809520582 implements MigrationInterface {
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
      ALTER TABLE "transactions"
        ADD COLUMN IF NOT EXISTS "tax_rate_percent" numeric(18,4),
        ADD COLUMN IF NOT EXISTS "taxable_amount" numeric(18,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "item_base_amount" numeric(18,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "item_taxable_amount" numeric(18,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "item_tax_amount" numeric(18,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "additional_charge_base_amount" numeric(18,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "additional_charge_tax_amount" numeric(18,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "igst_amount" numeric(18,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "cgst_amount" numeric(18,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "sgst_amount" numeric(18,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "final_amount" numeric(18,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "split_mode" "public"."transaction_tax_split_mode_enum";
    `);

    await queryRunner.query(`
      ALTER TABLE "transaction_items"
        ADD COLUMN IF NOT EXISTS "taxable_amount" numeric(18,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "tax_rate_percent" numeric(18,4) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "gst_amount" numeric(18,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "igst_rate_percent" numeric(18,4) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "cgst_rate_percent" numeric(18,4) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "sgst_rate_percent" numeric(18,4) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "igst_amount" numeric(18,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "cgst_amount" numeric(18,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "sgst_amount" numeric(18,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "split_mode" "public"."transaction_tax_split_mode_enum";
    `);

    await queryRunner.query(`
      ALTER TABLE "transaction_additional_charges"
        ADD COLUMN IF NOT EXISTS "tax_rate_percent" numeric(18,4) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "igst_rate_percent" numeric(18,4) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "cgst_rate_percent" numeric(18,4) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "sgst_rate_percent" numeric(18,4) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "igst_amount" numeric(18,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "cgst_amount" numeric(18,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "sgst_amount" numeric(18,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "split_mode" "public"."transaction_tax_split_mode_enum";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "transaction_additional_charges"
        DROP COLUMN IF EXISTS "split_mode",
        DROP COLUMN IF EXISTS "sgst_amount",
        DROP COLUMN IF EXISTS "cgst_amount",
        DROP COLUMN IF EXISTS "igst_amount",
        DROP COLUMN IF EXISTS "sgst_rate_percent",
        DROP COLUMN IF EXISTS "cgst_rate_percent",
        DROP COLUMN IF EXISTS "igst_rate_percent",
        DROP COLUMN IF EXISTS "tax_rate_percent";
    `);

    await queryRunner.query(`
      ALTER TABLE "transaction_items"
        DROP COLUMN IF EXISTS "split_mode",
        DROP COLUMN IF EXISTS "sgst_amount",
        DROP COLUMN IF EXISTS "cgst_amount",
        DROP COLUMN IF EXISTS "igst_amount",
        DROP COLUMN IF EXISTS "sgst_rate_percent",
        DROP COLUMN IF EXISTS "cgst_rate_percent",
        DROP COLUMN IF EXISTS "igst_rate_percent",
        DROP COLUMN IF EXISTS "gst_amount",
        DROP COLUMN IF EXISTS "tax_rate_percent",
        DROP COLUMN IF EXISTS "taxable_amount";
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions"
        DROP COLUMN IF EXISTS "split_mode",
        DROP COLUMN IF EXISTS "final_amount",
        DROP COLUMN IF EXISTS "sgst_amount",
        DROP COLUMN IF EXISTS "cgst_amount",
        DROP COLUMN IF EXISTS "igst_amount",
        DROP COLUMN IF EXISTS "additional_charge_tax_amount",
        DROP COLUMN IF EXISTS "additional_charge_base_amount",
        DROP COLUMN IF EXISTS "item_tax_amount",
        DROP COLUMN IF EXISTS "item_taxable_amount",
        DROP COLUMN IF EXISTS "item_base_amount",
        DROP COLUMN IF EXISTS "taxable_amount",
        DROP COLUMN IF EXISTS "tax_rate_percent";
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'transaction_tax_split_mode_enum'
        ) THEN
          DROP TYPE "public"."transaction_tax_split_mode_enum";
        END IF;
      END
      $$;
    `);
  }
}
