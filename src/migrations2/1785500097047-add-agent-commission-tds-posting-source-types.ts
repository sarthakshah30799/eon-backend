import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAgentCommissionTdsPostingSourceTypes1785500097047 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."transaction_account_postings_source_type_enum" ADD VALUE IF NOT EXISTS 'AGENT_COMMISSION'`);
        await queryRunner.query(`ALTER TYPE "public"."transaction_account_postings_source_type_enum" ADD VALUE IF NOT EXISTS 'TDS'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."transaction_account_postings_source_type_enum" RENAME TO "transaction_account_postings_source_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."transaction_account_postings_source_type_enum" AS ENUM('ITEM', 'ITEM_PROFIT', 'ITEM_SALE', 'ROUND_OFF', 'PARTY_CONTROL', 'ADDITIONAL_CHARGE', 'TAX_ITEM', 'TAX_ADDITIONAL_CHARGE', 'PAYMENT')`);
        await queryRunner.query(`ALTER TABLE "transaction_account_postings" ALTER COLUMN "source_type" TYPE "public"."transaction_account_postings_source_type_enum" USING "source_type"::"text"::"public"."transaction_account_postings_source_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transaction_account_postings_source_type_enum_old"`);
    }

}
