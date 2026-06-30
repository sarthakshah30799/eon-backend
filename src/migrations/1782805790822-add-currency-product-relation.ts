import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCurrencyProductRelation1782805790822 implements MigrationInterface {
    name = 'AddCurrencyProductRelation1782805790822'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."product_currency_rates_margin_type_enum" AS ENUM('PERCENT', 'RATE')`);
        await queryRunner.query(`CREATE TABLE "product_currency_rates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "product_id" uuid NOT NULL, "currency_id" uuid NOT NULL, "buy_margin_type" "public"."product_currency_rates_margin_type_enum" NOT NULL, "buy_margin_value" numeric NOT NULL, "buy_min_rate" numeric NOT NULL, "buy_max_rate" numeric NOT NULL, "sale_margin_type" "public"."product_currency_rates_margin_type_enum" NOT NULL, "sale_margin_value" numeric NOT NULL, "sale_min_rate" numeric NOT NULL, "sale_max_rate" numeric NOT NULL, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_0bbd5eb9fdc2475c5ef6b3c30df" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_product_currency_rates_product_currency" ON "product_currency_rates" ("product_id", "currency_id") `);
        await queryRunner.query(`ALTER TYPE "public"."currency_rates_provider_enum" RENAME TO "currency_rates_provider_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."currency_rates_provider_enum" AS ENUM('TICKER', 'FOREX', 'MANUAL')`);
        await queryRunner.query(`ALTER TABLE "currency_rates" ALTER COLUMN "provider" TYPE "public"."currency_rates_provider_enum" USING "provider"::"text"::"public"."currency_rates_provider_enum"`);
        await queryRunner.query(`DROP TYPE "public"."currency_rates_provider_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."advanced_settings_value_type_enum" RENAME TO "advanced_settings_value_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."advanced_settings_value_type_enum" AS ENUM('boolean', 'text', 'number', 'decimal', 'date', 'select', 'json')`);
        await queryRunner.query(`ALTER TABLE "advanced_settings" ALTER COLUMN "value_type" TYPE "public"."advanced_settings_value_type_enum" USING "value_type"::"text"::"public"."advanced_settings_value_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."advanced_settings_value_type_enum_old"`);
        await queryRunner.query(`ALTER TABLE "product_currency_rates" ADD CONSTRAINT "FK_50a6dfe82e5b8750490a085004f" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_currency_rates" ADD CONSTRAINT "FK_c4c3741c4b5f461623ae844c21b" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "product_currency_rates" DROP CONSTRAINT "FK_c4c3741c4b5f461623ae844c21b"`);
        await queryRunner.query(`ALTER TABLE "product_currency_rates" DROP CONSTRAINT "FK_50a6dfe82e5b8750490a085004f"`);
        await queryRunner.query(`CREATE TYPE "public"."advanced_settings_value_type_enum_old" AS ENUM('boolean', 'text', 'number', 'decimal', 'date', 'json')`);
        await queryRunner.query(`ALTER TABLE "advanced_settings" ALTER COLUMN "value_type" TYPE "public"."advanced_settings_value_type_enum_old" USING "value_type"::"text"::"public"."advanced_settings_value_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."advanced_settings_value_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."advanced_settings_value_type_enum_old" RENAME TO "advanced_settings_value_type_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."currency_rates_provider_enum_old" AS ENUM('TICKER', 'FOREX')`);
        await queryRunner.query(`ALTER TABLE "currency_rates" ALTER COLUMN "provider" TYPE "public"."currency_rates_provider_enum_old" USING "provider"::"text"::"public"."currency_rates_provider_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."currency_rates_provider_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."currency_rates_provider_enum_old" RENAME TO "currency_rates_provider_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_product_currency_rates_product_currency"`);
        await queryRunner.query(`DROP TABLE "product_currency_rates"`);
        await queryRunner.query(`DROP TYPE "public"."product_currency_rates_margin_type_enum"`);
    }

}
