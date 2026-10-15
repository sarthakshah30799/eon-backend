import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * AdvanceRefundTables1791995713587 (TypeORM generate) split the shared
 * purpose_rate_type_enum into per-column enums and dropped the original type.
 * refresh_transaction_tcs still casts to purpose_rate_type_enum, so inserts
 * that fire transaction_tcs_refresh_trigger fail.
 *
 * Restore the shared enum and point both columns back at it.
 */
export class RestorePurposeRateTypeEnum1791996800000
  implements MigrationInterface
{
  name = "RestorePurposeRateTypeEnum1791996800000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regtype('public.purpose_rate_type_enum') IS NULL THEN
          CREATE TYPE "public"."purpose_rate_type_enum" AS ENUM('PERCENT', 'RUPEES');
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions"
        ALTER COLUMN "tcs_rate_type"
        TYPE "public"."purpose_rate_type_enum"
        USING "tcs_rate_type"::"text"::"public"."purpose_rate_type_enum"
    `);

    await queryRunner.query(`
      ALTER TABLE "transaction_tcs_breakdowns"
        ALTER COLUMN "rate_type" DROP DEFAULT
    `);
    await queryRunner.query(`
      ALTER TABLE "transaction_tcs_breakdowns"
        ALTER COLUMN "rate_type"
        TYPE "public"."purpose_rate_type_enum"
        USING "rate_type"::"text"::"public"."purpose_rate_type_enum"
    `);
    await queryRunner.query(`
      ALTER TABLE "transaction_tcs_breakdowns"
        ALTER COLUMN "rate_type" SET DEFAULT 'PERCENT'
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."transactions_tcs_rate_type_enum"
    `);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."transaction_tcs_breakdowns_rate_type_enum"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."transaction_tcs_breakdowns_rate_type_enum" AS ENUM('PERCENT', 'RUPEES')
    `);
    await queryRunner.query(`
      ALTER TABLE "transaction_tcs_breakdowns"
        ALTER COLUMN "rate_type" DROP DEFAULT
    `);
    await queryRunner.query(`
      ALTER TABLE "transaction_tcs_breakdowns"
        ALTER COLUMN "rate_type"
        TYPE "public"."transaction_tcs_breakdowns_rate_type_enum"
        USING "rate_type"::"text"::"public"."transaction_tcs_breakdowns_rate_type_enum"
    `);
    await queryRunner.query(`
      ALTER TABLE "transaction_tcs_breakdowns"
        ALTER COLUMN "rate_type" SET DEFAULT 'PERCENT'
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."transactions_tcs_rate_type_enum" AS ENUM('PERCENT', 'RUPEES')
    `);
    await queryRunner.query(`
      ALTER TABLE "transactions"
        ALTER COLUMN "tcs_rate_type"
        TYPE "public"."transactions_tcs_rate_type_enum"
        USING "tcs_rate_type"::"text"::"public"."transactions_tcs_rate_type_enum"
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."purpose_rate_type_enum"
    `);
  }
}
