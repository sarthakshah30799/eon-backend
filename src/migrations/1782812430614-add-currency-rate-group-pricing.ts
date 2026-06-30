import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCurrencyRateGroupPricing1782812430614 implements MigrationInterface {
    name = 'AddCurrencyRateGroupPricing1782812430614'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1
                FROM pg_type t
                JOIN pg_namespace n ON n.oid = t.typnamespace
                WHERE t.typname = 'currency_rate_groups_margin_type_enum'
                  AND n.nspname = 'public'
              ) THEN
                CREATE TYPE "public"."currency_rate_groups_margin_type_enum" AS ENUM('PERCENT', 'RATE');
              END IF;
            END
            $$;
        `);
        await queryRunner.query(`ALTER TABLE "currency_rate_groups" ADD "buy_margin_type" "public"."currency_rate_groups_margin_type_enum"`);
        await queryRunner.query(`ALTER TABLE "currency_rate_groups" ADD "buy_margin_value" numeric`);
        await queryRunner.query(`ALTER TABLE "currency_rate_groups" ADD "buy_min_rate" numeric`);
        await queryRunner.query(`ALTER TABLE "currency_rate_groups" ADD "buy_max_rate" numeric`);
        await queryRunner.query(`ALTER TABLE "currency_rate_groups" ADD "sale_margin_type" "public"."currency_rate_groups_margin_type_enum"`);
        await queryRunner.query(`ALTER TABLE "currency_rate_groups" ADD "sale_margin_value" numeric`);
        await queryRunner.query(`ALTER TABLE "currency_rate_groups" ADD "sale_min_rate" numeric`);
        await queryRunner.query(`ALTER TABLE "currency_rate_groups" ADD "sale_max_rate" numeric`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "currency_rate_groups" DROP COLUMN "sale_max_rate"`);
        await queryRunner.query(`ALTER TABLE "currency_rate_groups" DROP COLUMN "sale_min_rate"`);
        await queryRunner.query(`ALTER TABLE "currency_rate_groups" DROP COLUMN "sale_margin_value"`);
        await queryRunner.query(`ALTER TABLE "currency_rate_groups" DROP COLUMN "sale_margin_type"`);
        await queryRunner.query(`ALTER TABLE "currency_rate_groups" DROP COLUMN "buy_max_rate"`);
        await queryRunner.query(`ALTER TABLE "currency_rate_groups" DROP COLUMN "buy_min_rate"`);
        await queryRunner.query(`ALTER TABLE "currency_rate_groups" DROP COLUMN "buy_margin_value"`);
        await queryRunner.query(`ALTER TABLE "currency_rate_groups" DROP COLUMN "buy_margin_type"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."currency_rate_groups_margin_type_enum"`);
    }

}
