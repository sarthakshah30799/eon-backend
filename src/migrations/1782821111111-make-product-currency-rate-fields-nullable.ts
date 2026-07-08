import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeProductCurrencyRateFieldsNullable1782821111111 implements MigrationInterface {
  name = 'MakeProductCurrencyRateFieldsNullable1782821111111';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "product_currency_rates" ALTER COLUMN "buy_margin_type" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "product_currency_rates" ALTER COLUMN "buy_margin_value" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "product_currency_rates" ALTER COLUMN "buy_min_rate" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "product_currency_rates" ALTER COLUMN "buy_max_rate" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "product_currency_rates" ALTER COLUMN "sale_margin_type" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "product_currency_rates" ALTER COLUMN "sale_margin_value" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "product_currency_rates" ALTER COLUMN "sale_min_rate" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "product_currency_rates" ALTER COLUMN "sale_max_rate" DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "product_currency_rates" ALTER COLUMN "sale_max_rate" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "product_currency_rates" ALTER COLUMN "sale_min_rate" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "product_currency_rates" ALTER COLUMN "sale_margin_value" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "product_currency_rates" ALTER COLUMN "sale_margin_type" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "product_currency_rates" ALTER COLUMN "buy_max_rate" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "product_currency_rates" ALTER COLUMN "buy_min_rate" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "product_currency_rates" ALTER COLUMN "buy_margin_value" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "product_currency_rates" ALTER COLUMN "buy_margin_type" SET NOT NULL`);
  }
}

