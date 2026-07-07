import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameCurrencyRateMarginRateToPaisa1783009684058
  implements MigrationInterface
{
  name = 'RenameCurrencyRateMarginRateToPaisa1783009684058';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."currency_rate_groups_margin_type_enum" RENAME VALUE 'RATE' TO 'PAISA'`
    );
    await queryRunner.query(
      `ALTER TYPE "public"."product_currency_rates_margin_type_enum" RENAME VALUE 'RATE' TO 'PAISA'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."product_currency_rates_margin_type_enum" RENAME VALUE 'PAISA' TO 'RATE'`
    );
    await queryRunner.query(
      `ALTER TYPE "public"."currency_rate_groups_margin_type_enum" RENAME VALUE 'PAISA' TO 'RATE'`
    );
  }
}
