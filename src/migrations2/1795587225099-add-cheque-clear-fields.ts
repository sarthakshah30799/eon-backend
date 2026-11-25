import { MigrationInterface, QueryRunner } from "typeorm";

export class AddChequeClearFields1795587225099 implements MigrationInterface {
  name = "AddChequeClearFields1795587225099";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "transaction_payments"
      ADD COLUMN IF NOT EXISTS "clearance_counterpart_voucher_id" uuid
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_transaction_payments_clearance_counterpart_voucher_id"
      ON "transaction_payments" ("clearance_counterpart_voucher_id")
    `);

    // Drop invalid soft links so FK creation does not fail on orphans.
    await queryRunner.query(`
      UPDATE "accounting_vouchers" AS v
      SET "paired_voucher_id" = NULL
      WHERE v."paired_voucher_id" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM "accounting_vouchers" AS p
          WHERE p."id" = v."paired_voucher_id"
        )
    `);

    await queryRunner.query(`
      UPDATE "transaction_payments" AS tp
      SET "clearance_counterpart_voucher_id" = NULL
      WHERE tp."clearance_counterpart_voucher_id" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM "accounting_vouchers" AS v
          WHERE v."id" = tp."clearance_counterpart_voucher_id"
        )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_accounting_vouchers_paired_voucher_id'
        ) THEN
          ALTER TABLE "accounting_vouchers"
          ADD CONSTRAINT "FK_accounting_vouchers_paired_voucher_id"
          FOREIGN KEY ("paired_voucher_id")
          REFERENCES "accounting_vouchers"("id")
          ON DELETE SET NULL
          ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_transaction_payments_clearance_counterpart_voucher_id'
        ) THEN
          ALTER TABLE "transaction_payments"
          ADD CONSTRAINT "FK_transaction_payments_clearance_counterpart_voucher_id"
          FOREIGN KEY ("clearance_counterpart_voucher_id")
          REFERENCES "accounting_vouchers"("id")
          ON DELETE SET NULL
          ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "transaction_payments"
      DROP CONSTRAINT IF EXISTS "FK_transaction_payments_clearance_counterpart_voucher_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "accounting_vouchers"
      DROP CONSTRAINT IF EXISTS "FK_accounting_vouchers_paired_voucher_id"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_transaction_payments_clearance_counterpart_voucher_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "transaction_payments"
      DROP COLUMN IF EXISTS "clearance_counterpart_voucher_id"
    `);
  }
}
