import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSoftDeleteColumnsToBaseEntities1784223345297 implements MigrationInterface {
    name = 'AddSoftDeleteColumnsToBaseEntities1784223345297'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction_items" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "transaction_items" ADD "deleted_by" uuid`);
        await queryRunner.query(`ALTER TABLE "transaction_documents" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "transaction_documents" ADD "deleted_by" uuid`);
        await queryRunner.query(`ALTER TABLE "transaction_additional_charges" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "transaction_additional_charges" ADD "deleted_by" uuid`);
        await queryRunner.query(`ALTER TABLE "transaction_payments" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "transaction_payments" ADD "deleted_by" uuid`);
        await queryRunner.query(`ALTER TABLE "transaction_account_postings" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "transaction_account_postings" ADD "deleted_by" uuid`);
        await queryRunner.query(`ALTER TABLE "transaction_logs" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "transaction_logs" ADD "deleted_by" uuid`);
        await queryRunner.query(`ALTER TABLE "transaction_events" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "transaction_events" ADD "deleted_by" uuid`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "deleted_by" uuid`);
        await queryRunner.query(`ALTER TABLE "transaction_ad1" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "transaction_ad1" ADD "deleted_by" uuid`);
        await queryRunner.query(`ALTER TYPE "public"."posting_source_type" RENAME TO "posting_source_type_old"`);
        await queryRunner.query(`CREATE TYPE "public"."transaction_account_postings_source_type_enum" AS ENUM('ITEM', 'ITEM_PROFIT', 'ITEM_SALE', 'PARTY_CONTROL', 'ADDITIONAL_CHARGE', 'PAYMENT')`);
        await queryRunner.query(`ALTER TABLE "transaction_account_postings" ALTER COLUMN "source_type" TYPE "public"."transaction_account_postings_source_type_enum" USING "source_type"::"text"::"public"."transaction_account_postings_source_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."posting_source_type_old"`);
        await queryRunner.query(`CREATE TYPE "public"."transaction_ad1_transaction_type_enum" AS ENUM('SALE', 'PURCHASE')`);
        await queryRunner.query(`ALTER TABLE "transaction_ad1" ALTER COLUMN "transaction_type" TYPE "public"."transaction_ad1_transaction_type_enum" USING "transaction_type"::"text"::"public"."transaction_ad1_transaction_type_enum"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction_ad1" ALTER COLUMN "transaction_type" TYPE "public"."transactions_transaction_type_enum" USING "transaction_type"::"text"::"public"."transactions_transaction_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transaction_ad1_transaction_type_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."posting_source_type_old" AS ENUM('ITEM', 'ITEM_PROFIT', 'ITEM_SALE', 'PARTY_CONTROL', 'ADDITIONAL_CHARGE', 'PAYMENT')`);
        await queryRunner.query(`ALTER TABLE "transaction_account_postings" ALTER COLUMN "source_type" TYPE "public"."posting_source_type_old" USING "source_type"::"text"::"public"."posting_source_type_old"`);
        await queryRunner.query(`DROP TYPE "public"."transaction_account_postings_source_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."posting_source_type_old" RENAME TO "posting_source_type"`);
        await queryRunner.query(`ALTER TABLE "transaction_ad1" DROP COLUMN "deleted_by"`);
        await queryRunner.query(`ALTER TABLE "transaction_ad1" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "deleted_by"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "transaction_events" DROP COLUMN "deleted_by"`);
        await queryRunner.query(`ALTER TABLE "transaction_events" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "transaction_logs" DROP COLUMN "deleted_by"`);
        await queryRunner.query(`ALTER TABLE "transaction_logs" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "transaction_account_postings" DROP COLUMN "deleted_by"`);
        await queryRunner.query(`ALTER TABLE "transaction_account_postings" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "transaction_payments" DROP COLUMN "deleted_by"`);
        await queryRunner.query(`ALTER TABLE "transaction_payments" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "transaction_additional_charges" DROP COLUMN "deleted_by"`);
        await queryRunner.query(`ALTER TABLE "transaction_additional_charges" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "transaction_documents" DROP COLUMN "deleted_by"`);
        await queryRunner.query(`ALTER TABLE "transaction_documents" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "transaction_items" DROP COLUMN "deleted_by"`);
        await queryRunner.query(`ALTER TABLE "transaction_items" DROP COLUMN "deleted_at"`);
    }

}
