import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameTransactionAccountPostingsFields1784205109833 implements MigrationInterface {
    name = 'RenameTransactionAccountPostingsFields1784205109833'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TYPE "public"."posting_source_type" AS ENUM('ITEM', 'ITEM_PROFIT', 'ITEM_SALE', 'PARTY_CONTROL', 'ADDITIONAL_CHARGE', 'PAYMENT')
        `);
        await queryRunner.query(`
            ALTER TABLE "transaction_account_postings"
            ALTER COLUMN "source_type" TYPE "public"."posting_source_type"
            USING "source_type"::text::"public"."posting_source_type"
        `);
        await queryRunner.query(`
            ALTER TABLE "transaction_account_postings"
            RENAME COLUMN "debit_credit" TO "direction"
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "transaction_account_postings"
            RENAME COLUMN "direction" TO "debit_credit"
        `);
        await queryRunner.query(`
            ALTER TABLE "transaction_account_postings"
            ALTER COLUMN "source_type" TYPE character varying(50)
            USING "source_type"::text
        `);
        await queryRunner.query(`
            DROP TYPE "public"."posting_source_type"
        `);
    }

}
