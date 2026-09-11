import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAdviceDebitCredit1789041388930 implements MigrationInterface {
    name = 'AddAdviceDebitCredit1789041388930'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" ADD "source_branch_id" uuid`);
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" ADD "source_branch_snapshot" jsonb`);
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" ADD "destination_branch_id" uuid`);
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" ADD "destination_branch_snapshot" jsonb`);
        await queryRunner.query(`CREATE TYPE "public"."accounting_vouchers_header_direction_enum" AS ENUM('DEBIT', 'CREDIT')`);
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" ADD "header_direction" "public"."accounting_vouchers_header_direction_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."accounting_vouchers_advice_role_enum" AS ENUM('ISSUER', 'HONOUR')`);
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" ADD "advice_role" "public"."accounting_vouchers_advice_role_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."accounting_vouchers_advice_status_enum" AS ENUM('PENDING_HONOUR', 'HONOURED')`);
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" ADD "advice_status" "public"."accounting_vouchers_advice_status_enum"`);
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" ADD "paired_voucher_id" uuid`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "original_transaction_id" uuid`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "originating_voucher_id" uuid`);
        await queryRunner.query(`DROP INDEX "public"."UQ_accounting_vouchers_cheque"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_accounting_vouchers_type_date"`);
        await queryRunner.query(`ALTER TYPE "public"."accounting_vouchers_voucher_type_enum" RENAME TO "accounting_vouchers_voucher_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."accounting_vouchers_voucher_type_enum" AS ENUM('RECEIPT', 'PAYMENT', 'JOURNAL', 'DEPOSIT_WITHDRAWAL', 'ADVICE')`);
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" ALTER COLUMN "voucher_type" TYPE "public"."accounting_vouchers_voucher_type_enum" USING "voucher_type"::"text"::"public"."accounting_vouchers_voucher_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."accounting_vouchers_voucher_type_enum_old"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_accounting_vouchers_cheque" ON "accounting_vouchers" ("voucher_type", "header_account_id", "normalized_cheque_number") WHERE "normalized_cheque_number" IS NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_accounting_vouchers_advice_status" ON "accounting_vouchers" ("voucher_type", "advice_status", "destination_branch_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_accounting_vouchers_destination_branch" ON "accounting_vouchers" ("destination_branch_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_accounting_vouchers_source_branch" ON "accounting_vouchers" ("source_branch_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_accounting_vouchers_type_date" ON "accounting_vouchers" ("voucher_type", "transaction_date") `);
        await queryRunner.query(`CREATE INDEX "IDX_transactions_originating_voucher_id" ON "transactions" ("originating_voucher_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_transactions_original_transaction_id" ON "transactions" ("original_transaction_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_transactions_original_transaction_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transactions_originating_voucher_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_accounting_vouchers_type_date"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_accounting_vouchers_source_branch"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_accounting_vouchers_destination_branch"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_accounting_vouchers_advice_status"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_accounting_vouchers_cheque"`);
        await queryRunner.query(`CREATE TYPE "public"."accounting_vouchers_voucher_type_enum_old" AS ENUM('RECEIPT', 'PAYMENT', 'JOURNAL', 'DEPOSIT_WITHDRAWAL')`);
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" ALTER COLUMN "voucher_type" TYPE "public"."accounting_vouchers_voucher_type_enum_old" USING "voucher_type"::"text"::"public"."accounting_vouchers_voucher_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."accounting_vouchers_voucher_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."accounting_vouchers_voucher_type_enum_old" RENAME TO "accounting_vouchers_voucher_type_enum"`);
        await queryRunner.query(`CREATE INDEX "IDX_accounting_vouchers_type_date" ON "accounting_vouchers" ("transaction_date", "voucher_type") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_accounting_vouchers_cheque" ON "accounting_vouchers" ("header_account_id", "normalized_cheque_number", "voucher_type") WHERE (normalized_cheque_number IS NOT NULL)`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "originating_voucher_id"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "original_transaction_id"`);
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" DROP COLUMN "paired_voucher_id"`);
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" DROP COLUMN "advice_status"`);
        await queryRunner.query(`DROP TYPE "public"."accounting_vouchers_advice_status_enum"`);
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" DROP COLUMN "advice_role"`);
        await queryRunner.query(`DROP TYPE "public"."accounting_vouchers_advice_role_enum"`);
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" DROP COLUMN "header_direction"`);
        await queryRunner.query(`DROP TYPE "public"."accounting_vouchers_header_direction_enum"`);
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" DROP COLUMN "destination_branch_snapshot"`);
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" DROP COLUMN "destination_branch_id"`);
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" DROP COLUMN "source_branch_snapshot"`);
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" DROP COLUMN "source_branch_id"`);
    }

}
