import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTcsPostingSourceType1788967627702 implements MigrationInterface {
    name = 'AddTcsPostingSourceType1788967627702'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" DROP COLUMN "payment_method"`);
        await queryRunner.query(`DROP TYPE "public"."accounting_vouchers_payment_method_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."transaction_account_postings_source_type_enum" RENAME TO "transaction_account_postings_source_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."transaction_account_postings_source_type_enum" AS ENUM('ITEM', 'ITEM_PROFIT', 'ITEM_SALE', 'ROUND_OFF', 'PARTY_CONTROL', 'ADDITIONAL_CHARGE', 'TAX_ITEM', 'TAX_ADDITIONAL_CHARGE', 'AGENT_COMMISSION', 'TDS', 'TCS', 'PAYMENT', 'FAKE_CURRENCY')`);
        await queryRunner.query(`ALTER TABLE "transaction_account_postings" ALTER COLUMN "source_type" TYPE "public"."transaction_account_postings_source_type_enum" USING "source_type"::"text"::"public"."transaction_account_postings_source_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transaction_account_postings_source_type_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."transaction_account_postings_source_type_enum_old" AS ENUM('ITEM', 'ITEM_PROFIT', 'ITEM_SALE', 'ROUND_OFF', 'PARTY_CONTROL', 'ADDITIONAL_CHARGE', 'TAX_ITEM', 'TAX_ADDITIONAL_CHARGE', 'AGENT_COMMISSION', 'TDS', 'PAYMENT', 'FAKE_CURRENCY')`);
        await queryRunner.query(`ALTER TABLE "transaction_account_postings" ALTER COLUMN "source_type" TYPE "public"."transaction_account_postings_source_type_enum_old" USING "source_type"::"text"::"public"."transaction_account_postings_source_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."transaction_account_postings_source_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."transaction_account_postings_source_type_enum_old" RENAME TO "transaction_account_postings_source_type_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."accounting_vouchers_payment_method_enum" AS ENUM('CASH', 'CHEQUE', 'BANK_TRANSFER', 'UPI', 'NEFT', 'RTGS', 'IMPS', 'CARD', 'OTHER')`);
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" ADD "payment_method" "public"."accounting_vouchers_payment_method_enum"`);
    }

}
