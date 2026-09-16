import { MigrationInterface, QueryRunner } from "typeorm";

export class VoucherPrintLogs1789453428139 implements MigrationInterface {
    name = 'VoucherPrintLogs1789453428139'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."accounting_voucher_logs_action_enum" AS ENUM('PRINT', 'CREATE', 'UPDATE', 'SUBMIT', 'APPROVE', 'REJECT', 'VERSION_CREATE', 'DOCUMENT_UPDATE', 'ADDITIONAL_CHARGE_UPDATE', 'PAYMENT_UPDATE')`);
        await queryRunner.query(`CREATE TABLE "accounting_voucher_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "voucher_id" uuid NOT NULL, "action" "public"."accounting_voucher_logs_action_enum" NOT NULL, "message" text NOT NULL, "before_snapshot" jsonb, "after_snapshot" jsonb, "metadata" jsonb, "performed_by_id" uuid, "performed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_13f0cb2cacb1459a591c60ad630" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_accounting_voucher_logs_voucher_id" ON "accounting_voucher_logs" ("voucher_id") `);
        await queryRunner.query(`ALTER TABLE "accounting_voucher_logs" ADD CONSTRAINT "FK_accounting_voucher_logs_voucher_id" FOREIGN KEY ("voucher_id") REFERENCES "accounting_vouchers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "accounting_voucher_logs" DROP CONSTRAINT "FK_accounting_voucher_logs_voucher_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_accounting_voucher_logs_voucher_id"`);
        await queryRunner.query(`DROP TABLE "accounting_voucher_logs"`);
        await queryRunner.query(`DROP TYPE "public"."accounting_voucher_logs_action_enum"`);
    }

}
