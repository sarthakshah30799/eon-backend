import { MigrationInterface, QueryRunner } from "typeorm";

export class MoveTextUuidForCategoryOptions1782281668312 implements MigrationInterface {
    name = 'MoveTextUuidForCategoryOptions1782281668312'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "branches" DROP COLUMN "location_type"`);
        await queryRunner.query(`ALTER TABLE "branches" ADD "location_type" uuid`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "kyc_risk_category"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "kyc_risk_category" uuid`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "default_agent"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "default_agent" uuid`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "group"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "group" uuid`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "entity_type"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "entity_type" uuid`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "marketing_executive"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "marketing_executive" uuid`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "business_nature"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "business_nature" uuid`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "tds_group"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "tds_group" uuid`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "location"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "location" uuid`);
        await queryRunner.query(`ALTER TABLE "document_profiles" DROP COLUMN "specification_type"`);
        await queryRunner.query(`ALTER TABLE "document_profiles" ADD "specification_type" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "document_profiles" DROP COLUMN "type"`);
        await queryRunner.query(`ALTER TABLE "document_profiles" ADD "type" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "document_profiles" DROP COLUMN "group_selection"`);
        await queryRunner.query(`ALTER TABLE "document_profiles" ADD "group_selection" uuid`);
        await queryRunner.query(`ALTER TABLE "document_profiles" DROP COLUMN "entity_selection"`);
        await queryRunner.query(`ALTER TABLE "document_profiles" ADD "entity_selection" uuid`);
        await queryRunner.query(`ALTER TABLE "financial_codes" DROP COLUMN "financial_type"`);
        await queryRunner.query(`ALTER TABLE "financial_codes" ADD "financial_type" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "financial_codes" DROP COLUMN "default_sign"`);
        await queryRunner.query(`ALTER TABLE "financial_codes" ADD "default_sign" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "account_profiles" DROP COLUMN "division_dept"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" ADD "division_dept" uuid`);
        await queryRunner.query(`ALTER TABLE "account_profiles" DROP COLUMN "account_type"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" ADD "account_type" uuid`);
        await queryRunner.query(`ALTER TABLE "account_profiles" DROP COLUMN "sub_ledger"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" ADD "sub_ledger" uuid`);
        await queryRunner.query(`ALTER TABLE "account_profiles" DROP COLUMN "bank_nature"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" ADD "bank_nature" uuid`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "account_profiles" DROP COLUMN "bank_nature"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" ADD "bank_nature" citext`);
        await queryRunner.query(`ALTER TABLE "account_profiles" DROP COLUMN "sub_ledger"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" ADD "sub_ledger" citext`);
        await queryRunner.query(`ALTER TABLE "account_profiles" DROP COLUMN "account_type"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" ADD "account_type" citext`);
        await queryRunner.query(`ALTER TABLE "account_profiles" DROP COLUMN "division_dept"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" ADD "division_dept" citext`);
        await queryRunner.query(`ALTER TABLE "financial_codes" DROP COLUMN "default_sign"`);
        await queryRunner.query(`ALTER TABLE "financial_codes" ADD "default_sign" citext NOT NULL`);
        await queryRunner.query(`ALTER TABLE "financial_codes" DROP COLUMN "financial_type"`);
        await queryRunner.query(`ALTER TABLE "financial_codes" ADD "financial_type" citext NOT NULL`);
        await queryRunner.query(`ALTER TABLE "document_profiles" DROP COLUMN "entity_selection"`);
        await queryRunner.query(`ALTER TABLE "document_profiles" ADD "entity_selection" citext`);
        await queryRunner.query(`ALTER TABLE "document_profiles" DROP COLUMN "group_selection"`);
        await queryRunner.query(`ALTER TABLE "document_profiles" ADD "group_selection" citext`);
        await queryRunner.query(`ALTER TABLE "document_profiles" DROP COLUMN "type"`);
        await queryRunner.query(`ALTER TABLE "document_profiles" ADD "type" citext NOT NULL`);
        await queryRunner.query(`ALTER TABLE "document_profiles" DROP COLUMN "specification_type"`);
        await queryRunner.query(`ALTER TABLE "document_profiles" ADD "specification_type" citext NOT NULL`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "location"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "location" citext`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "tds_group"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "tds_group" citext`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "business_nature"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "business_nature" citext`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "marketing_executive"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "marketing_executive" citext`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "entity_type"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "entity_type" citext`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "group"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "group" citext`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "default_agent"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "default_agent" citext`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "kyc_risk_category"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "kyc_risk_category" citext`);
        await queryRunner.query(`ALTER TABLE "branches" DROP COLUMN "location_type"`);
        await queryRunner.query(`ALTER TABLE "branches" ADD "location_type" citext`);
    }

}
