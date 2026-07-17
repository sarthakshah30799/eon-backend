import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPartyProfileCommissionRule1784268493795 implements MigrationInterface {
  name = "AddPartyProfileCommissionRule1784268493795";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "financial_codes" RENAME COLUMN "default_sign" TO "default_sign_id"`,
    );
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE n.nspname = 'public'
            AND t.typname = 'party_profile_commission_rules_type_enum'
        ) THEN
          CREATE TYPE "public"."party_profile_commission_rules_type_enum" AS ENUM('PERCENTAGE', 'PAISA');
        END IF;
      END
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "party_profile_commission_rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "party_profile_id" uuid NOT NULL, "currency_code" citext NOT NULL, "currency_name" citext, "product_code" citext NOT NULL, "product_description" citext, "commission_type" "public"."party_profile_commission_rules_type_enum" NOT NULL, "commission_value" numeric(18,4) NOT NULL, CONSTRAINT "PK_91261ab127a1176aed15e4edfd0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_party_profile_commission_rules_party_profile_id" ON "party_profile_commission_rules" ("party_profile_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_party_profile_commission_rules_party_currency_product" ON "party_profile_commission_rules" ("party_profile_id", "currency_code", "product_code") `,
    );
    await queryRunner.query(
      `ALTER TABLE "currency_rates" ALTER COLUMN "base_buy_rate" TYPE numeric(18,7)`,
    );
    await queryRunner.query(
      `ALTER TABLE "currency_rates" ALTER COLUMN "base_sale_rate" TYPE numeric(18,7)`,
    );
    await queryRunner.query(
      `ALTER TABLE "currency_rates" ALTER COLUMN "base_rate" TYPE numeric(18,7)`,
    );
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          WHERE t.relname = 'advanced_settings'
            AND c.conname = 'CHK_advanced_settings_transaction_number_series_length'
        ) THEN
          ALTER TABLE "advanced_settings"
          ADD CONSTRAINT "CHK_advanced_settings_transaction_number_series_length"
          CHECK (UPPER("code") NOT IN ('PURCHASE_FFMC', 'SALE_FFMC', 'PURCHASE_RMC', 'PURCHASE_FOREX', 'PURCHASE_FOREIGN', 'PURCHASE_MISC', 'PURCHASE_FRANCHISE') OR "value_number" IS NULL OR "value_number" BETWEEN 0 AND 999999999);
        END IF;
      END
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          WHERE t.relname = 'party_profile_commission_rules'
            AND c.conname = 'FK_party_profile_commission_rules_party_profile_id'
        ) THEN
          ALTER TABLE "party_profile_commission_rules"
          ADD CONSTRAINT "FK_party_profile_commission_rules_party_profile_id"
          FOREIGN KEY ("party_profile_id") REFERENCES "party_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END
      $$ LANGUAGE plpgsql;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "party_profile_commission_rules" DROP CONSTRAINT "FK_party_profile_commission_rules_party_profile_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "advanced_settings" DROP CONSTRAINT "CHK_advanced_settings_transaction_number_series_length"`,
    );
    await queryRunner.query(
      `ALTER TABLE "currency_rates" ALTER COLUMN "base_rate" TYPE numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "currency_rates" ALTER COLUMN "base_sale_rate" TYPE numeric`,
    );
    await queryRunner.query(
      `ALTER TABLE "currency_rates" ALTER COLUMN "base_buy_rate" TYPE numeric`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_party_profile_commission_rules_party_currency_product"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_party_profile_commission_rules_party_profile_id"`,
    );
    await queryRunner.query(`DROP TABLE "party_profile_commission_rules"`);
    await queryRunner.query(
      `DROP TYPE "public"."party_profile_commission_rules_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "financial_codes" RENAME COLUMN "default_sign_id" TO "default_sign"`,
    );
  }
}
