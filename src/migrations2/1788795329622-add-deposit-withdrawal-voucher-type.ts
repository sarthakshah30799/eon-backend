import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDepositWithdrawalVoucherType1788795329622 implements MigrationInterface {
    name = 'AddDepositWithdrawalVoucherType1788795329622'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."UQ_accounting_vouchers_cheque"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_accounting_vouchers_type_date"`);
        await queryRunner.query(`ALTER TYPE "public"."accounting_vouchers_voucher_type_enum" RENAME TO "accounting_vouchers_voucher_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."accounting_vouchers_voucher_type_enum" AS ENUM('RECEIPT', 'PAYMENT', 'JOURNAL', 'DEPOSIT_WITHDRAWAL')`);
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" ALTER COLUMN "voucher_type" TYPE "public"."accounting_vouchers_voucher_type_enum" USING "voucher_type"::"text"::"public"."accounting_vouchers_voucher_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."accounting_vouchers_voucher_type_enum_old"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_accounting_vouchers_cheque" ON "accounting_vouchers" ("voucher_type", "header_account_id", "normalized_cheque_number") WHERE "normalized_cheque_number" IS NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_accounting_vouchers_type_date" ON "accounting_vouchers" ("voucher_type", "transaction_date") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_accounting_vouchers_type_date"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_accounting_vouchers_cheque"`);
        await queryRunner.query(`CREATE TYPE "public"."accounting_vouchers_voucher_type_enum_old" AS ENUM('RECEIPT', 'PAYMENT', 'JOURNAL')`);
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" ALTER COLUMN "voucher_type" TYPE "public"."accounting_vouchers_voucher_type_enum_old" USING "voucher_type"::"text"::"public"."accounting_vouchers_voucher_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."accounting_vouchers_voucher_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."accounting_vouchers_voucher_type_enum_old" RENAME TO "accounting_vouchers_voucher_type_enum"`);
        await queryRunner.query(`CREATE INDEX "IDX_accounting_vouchers_type_date" ON "accounting_vouchers" ("transaction_date", "voucher_type") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_accounting_vouchers_cheque" ON "accounting_vouchers" ("header_account_id", "normalized_cheque_number", "voucher_type") WHERE (normalized_cheque_number IS NOT NULL)`);
    }

}
