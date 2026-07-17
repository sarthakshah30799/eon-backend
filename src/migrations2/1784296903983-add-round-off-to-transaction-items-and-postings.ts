import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRoundOffToTransactionItemsAndPostings1784296903983 implements MigrationInterface {
    name = 'AddRoundOffToTransactionItemsAndPostings1784296903983'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction_items" ADD "round_off" numeric(18,2)`);
        await queryRunner.query(`ALTER TYPE "public"."transaction_account_postings_source_type_enum" RENAME TO "transaction_account_postings_source_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."transaction_account_postings_source_type_enum" AS ENUM('ITEM', 'ITEM_PROFIT', 'ITEM_SALE', 'ROUND_OFF', 'PARTY_CONTROL', 'ADDITIONAL_CHARGE', 'PAYMENT')`);
        await queryRunner.query(`ALTER TABLE "transaction_account_postings" ALTER COLUMN "source_type" TYPE "public"."transaction_account_postings_source_type_enum" USING "source_type"::"text"::"public"."transaction_account_postings_source_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transaction_account_postings_source_type_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."transaction_account_postings_source_type_enum_old" AS ENUM('ADDITIONAL_CHARGE', 'ITEM', 'ITEM_PROFIT', 'ITEM_SALE', 'PARTY_CONTROL', 'PAYMENT')`);
        await queryRunner.query(`ALTER TABLE "transaction_account_postings" ALTER COLUMN "source_type" TYPE "public"."transaction_account_postings_source_type_enum_old" USING "source_type"::"text"::"public"."transaction_account_postings_source_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."transaction_account_postings_source_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."transaction_account_postings_source_type_enum_old" RENAME TO "transaction_account_postings_source_type_enum"`);
        await queryRunner.query(`ALTER TABLE "transaction_items" DROP COLUMN "round_off"`);
    }

}
