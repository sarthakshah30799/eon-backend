import { MigrationInterface, QueryRunner } from "typeorm";

export class AddChequeClearanceFields1793975269687 implements MigrationInterface {
    name = 'AddChequeClearanceFields1793975269687'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" ADD "bank_date" date`);
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" ADD "reconciliation_remarks" text`);
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" ADD "is_dishonored" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" ADD "reversal_number" citext`);
        await queryRunner.query(`ALTER TABLE "transaction_payments" ADD "bank_date" date`);
        await queryRunner.query(`ALTER TABLE "transaction_payments" ADD "reconciliation_remarks" text`);
        await queryRunner.query(`ALTER TABLE "transaction_payments" ADD "is_dishonored" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "transaction_payments" ADD "reversal_number" citext`);
        await queryRunner.query(`ALTER TYPE "public"."deal_covers_status_enum" RENAME TO "deal_covers_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."deal_covers_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" TYPE "public"."deal_covers_status_enum" USING "status"::"text"::"public"."deal_covers_status_enum"`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."deal_covers_status_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."deal_covers_status_enum_old" AS ENUM('APPROVED', 'CANCELLED', 'PENDING', 'REJECTED')`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" TYPE "public"."deal_covers_status_enum_old" USING "status"::"text"::"public"."deal_covers_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."deal_covers_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."deal_covers_status_enum_old" RENAME TO "deal_covers_status_enum"`);
        await queryRunner.query(`ALTER TABLE "transaction_payments" DROP COLUMN "reversal_number"`);
        await queryRunner.query(`ALTER TABLE "transaction_payments" DROP COLUMN "is_dishonored"`);
        await queryRunner.query(`ALTER TABLE "transaction_payments" DROP COLUMN "reconciliation_remarks"`);
        await queryRunner.query(`ALTER TABLE "transaction_payments" DROP COLUMN "bank_date"`);
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" DROP COLUMN "reversal_number"`);
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" DROP COLUMN "is_dishonored"`);
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" DROP COLUMN "reconciliation_remarks"`);
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" DROP COLUMN "bank_date"`);
    }

}
