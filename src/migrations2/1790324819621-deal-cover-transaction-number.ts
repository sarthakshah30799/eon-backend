import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Additive on top of already-run TtDealOpsTables1790103808616:
 * - system transaction_number (DEAL_COVER series at create)
 * - drop unique on deal_no (user-entered; uniqueness deferred)
 */
export class DealCoverTransactionNumber1790324819621
  implements MigrationInterface
{
  name = "DealCoverTransactionNumber1790324819621";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "deal_covers" ADD COLUMN IF NOT EXISTS "transaction_number" citext`,
    );
    await queryRunner.query(`
      UPDATE "deal_covers"
      SET "transaction_number" = 'LEGACY-' || REPLACE(id::text, '-', '')
      WHERE "transaction_number" IS NULL
    `);
    await queryRunner.query(
      `ALTER TABLE "deal_covers" ALTER COLUMN "transaction_number" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_deal_covers_transaction_number" ON "deal_covers" ("transaction_number")`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_deal_covers_deal_no"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_deal_covers_deal_no" ON "deal_covers" ("deal_no")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_deal_covers_deal_no"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_deal_covers_deal_no" ON "deal_covers" ("deal_no")`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_deal_covers_transaction_number"`,
    );
    await queryRunner.query(
      `ALTER TABLE "deal_covers" DROP COLUMN IF EXISTS "transaction_number"`,
    );
  }
}
