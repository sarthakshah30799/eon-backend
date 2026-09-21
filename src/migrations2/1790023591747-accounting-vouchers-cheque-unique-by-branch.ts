import { MigrationInterface, QueryRunner } from "typeorm";

export class AccountingVouchersChequeUniqueByBranch1790023591747 implements MigrationInterface {
    name = 'AccountingVouchersChequeUniqueByBranch1790023591747'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."UQ_accounting_vouchers_cheque"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_accounting_vouchers_cheque" ON "accounting_vouchers" ("voucher_type", "branch_id", "header_account_id", "normalized_cheque_number") WHERE "normalized_cheque_number" IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."UQ_accounting_vouchers_cheque"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_accounting_vouchers_cheque" ON "accounting_vouchers" ("header_account_id", "normalized_cheque_number", "voucher_type") WHERE (normalized_cheque_number IS NOT NULL)`);
    }

}
