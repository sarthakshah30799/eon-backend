import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPrintSnapshotsAndTransferPrintCount1787138137070 implements MigrationInterface {
  name = "AddPrintSnapshotsAndTransferPrintCount1787138137070";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "card_stock_receipts" ADD "company_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_receipts" ADD "company_snapshot" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_transfer_requests" ADD "company_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_transfer_requests" ADD "company_snapshot" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "transfer_requests" ADD "company_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "transfer_requests" ADD "company_snapshot" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "transfer_requests" ADD "print_count" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_ad1" ADD "company_snapshot" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_ad1" ADD "print_count" integer NOT NULL DEFAULT '0'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transaction_ad1" DROP COLUMN "print_count"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_ad1" DROP COLUMN "company_snapshot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transfer_requests" DROP COLUMN "print_count"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transfer_requests" DROP COLUMN "company_snapshot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transfer_requests" DROP COLUMN "company_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_transfer_requests" DROP COLUMN "company_snapshot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_transfer_requests" DROP COLUMN "company_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_receipts" DROP COLUMN "company_snapshot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_receipts" DROP COLUMN "company_id"`,
    );
  }
}
