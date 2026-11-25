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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_transaction_payments_clearance_counterpart_voucher_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "transaction_payments"
      DROP COLUMN IF EXISTS "clearance_counterpart_voucher_id"
    `);
  }
}
