import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOnlinePaymentMethod1788955935989 implements MigrationInterface {
    name = 'AddOnlinePaymentMethod1788955935989'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."accounting_vouchers_payment_method_enum" AS ENUM('CASH', 'CHEQUE', 'BANK_TRANSFER', 'UPI', 'NEFT', 'RTGS', 'IMPS', 'CARD', 'OTHER')`);
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" ADD "payment_method" "public"."accounting_vouchers_payment_method_enum"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" DROP COLUMN "payment_method"`);
        await queryRunner.query(`DROP TYPE "public"."accounting_vouchers_payment_method_enum"`);
    }

}
