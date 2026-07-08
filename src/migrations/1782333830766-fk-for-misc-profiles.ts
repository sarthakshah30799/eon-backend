import { MigrationInterface, QueryRunner } from "typeorm";

export class FkForMiscProfiles1782333830766 implements MigrationInterface {
    name = 'FkForMiscProfiles1782333830766'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "branches" RENAME COLUMN "location_type" TO "location_type_id"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" RENAME COLUMN "kyc_risk_category" TO "kyc_risk_category_id"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" RENAME COLUMN "default_agent" TO "default_agent_id"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" RENAME COLUMN "group" TO "group_id"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" RENAME COLUMN "entity_type" TO "entity_type_id"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" RENAME COLUMN "marketing_executive" TO "marketing_executive_id"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" RENAME COLUMN "business_nature" TO "business_nature_id"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" RENAME COLUMN "tds_group" TO "tds_group_id"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" RENAME COLUMN "location" TO "location_id"`);
        await queryRunner.query(`ALTER TABLE "financial_codes" RENAME COLUMN "financial_type" TO "financialType"`);
        await queryRunner.query(`ALTER TABLE "financial_codes" RENAME COLUMN "default_sign" TO "defaultSign"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" RENAME COLUMN "division_dept" TO "division_dept_id"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" RENAME COLUMN "account_type" TO "account_type_id"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" RENAME COLUMN "sub_ledger" TO "sub_ledger_id"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" RENAME COLUMN "bank_nature" TO "bank_nature_id"`);
        await queryRunner.query(`ALTER TABLE "branches" ADD CONSTRAINT "FK_branches_location_type" FOREIGN KEY ("location_type_id") REFERENCES "category_options"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD CONSTRAINT "FK_party_profiles_kyc_risk_category" FOREIGN KEY ("kyc_risk_category_id") REFERENCES "category_options"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD CONSTRAINT "FK_party_profiles_defaultAgent" FOREIGN KEY ("default_agent_id") REFERENCES "category_options"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD CONSTRAINT "FK_party_profiles_group" FOREIGN KEY ("group_id") REFERENCES "category_options"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD CONSTRAINT "FK_party_profiles_entityType" FOREIGN KEY ("entity_type_id") REFERENCES "category_options"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD CONSTRAINT "FK_party_profiles_marketingExecutive" FOREIGN KEY ("marketing_executive_id") REFERENCES "category_options"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD CONSTRAINT "FK_party_profiles_businessNature" FOREIGN KEY ("business_nature_id") REFERENCES "category_options"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD CONSTRAINT "FK_party_profiles_tdsGroup" FOREIGN KEY ("tds_group_id") REFERENCES "category_options"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD CONSTRAINT "FK_party_profiles_location" FOREIGN KEY ("location_id") REFERENCES "category_options"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document_profiles" ADD CONSTRAINT "FK_27461fd0cd923a113c57abe649f" FOREIGN KEY ("type") REFERENCES "category_options"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document_profiles" ADD CONSTRAINT "FK_bb53e6e5e081c6aa76e7245aa59" FOREIGN KEY ("group_selection") REFERENCES "category_options"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "document_profiles" ADD CONSTRAINT "FK_1318ca8995f27aefbe198636ca3" FOREIGN KEY ("entity_selection") REFERENCES "category_options"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "financial_codes" ADD CONSTRAINT "FK_financial_codes_financialType" FOREIGN KEY ("financialType") REFERENCES "category_options"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "financial_codes" ADD CONSTRAINT "FK_financial_codes_defaultSign" FOREIGN KEY ("defaultSign") REFERENCES "category_options"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "account_profiles" ADD CONSTRAINT "FK_account_profiles_division_dept" FOREIGN KEY ("division_dept_id") REFERENCES "category_options"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "account_profiles" ADD CONSTRAINT "FK_account_profiles_account_type" FOREIGN KEY ("account_type_id") REFERENCES "category_options"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "account_profiles" ADD CONSTRAINT "FK_account_profiles_sub_ledger" FOREIGN KEY ("sub_ledger_id") REFERENCES "category_options"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "account_profiles" ADD CONSTRAINT "FK_account_profiles_bank_nature" FOREIGN KEY ("bank_nature_id") REFERENCES "category_options"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "account_profiles" DROP CONSTRAINT "FK_account_profiles_bank_nature"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" DROP CONSTRAINT "FK_account_profiles_sub_ledger"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" DROP CONSTRAINT "FK_account_profiles_account_type"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" DROP CONSTRAINT "FK_account_profiles_division_dept"`);
        await queryRunner.query(`ALTER TABLE "financial_codes" DROP CONSTRAINT "FK_financial_codes_defaultSign"`);
        await queryRunner.query(`ALTER TABLE "financial_codes" DROP CONSTRAINT "FK_financial_codes_financialType"`);
        await queryRunner.query(`ALTER TABLE "document_profiles" DROP CONSTRAINT "FK_1318ca8995f27aefbe198636ca3"`);
        await queryRunner.query(`ALTER TABLE "document_profiles" DROP CONSTRAINT "FK_bb53e6e5e081c6aa76e7245aa59"`);
        await queryRunner.query(`ALTER TABLE "document_profiles" DROP CONSTRAINT "FK_27461fd0cd923a113c57abe649f"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP CONSTRAINT "FK_party_profiles_location"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP CONSTRAINT "FK_party_profiles_tdsGroup"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP CONSTRAINT "FK_party_profiles_businessNature"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP CONSTRAINT "FK_party_profiles_marketingExecutive"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP CONSTRAINT "FK_party_profiles_entityType"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP CONSTRAINT "FK_party_profiles_group"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP CONSTRAINT "FK_party_profiles_defaultAgent"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP CONSTRAINT "FK_party_profiles_kyc_risk_category"`);
        await queryRunner.query(`ALTER TABLE "branches" DROP CONSTRAINT "FK_branches_location_type"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" RENAME COLUMN "bank_nature_id" TO "bank_nature"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" RENAME COLUMN "sub_ledger_id" TO "sub_ledger"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" RENAME COLUMN "account_type_id" TO "account_type"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" RENAME COLUMN "division_dept_id" TO "division_dept"`);
        await queryRunner.query(`ALTER TABLE "financial_codes" RENAME COLUMN "defaultSign" TO "default_sign"`);
        await queryRunner.query(`ALTER TABLE "financial_codes" RENAME COLUMN "financialType" TO "financial_type"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" RENAME COLUMN "location_id" TO "location"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" RENAME COLUMN "tds_group_id" TO "tds_group"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" RENAME COLUMN "business_nature_id" TO "business_nature"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" RENAME COLUMN "marketing_executive_id" TO "marketing_executive"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" RENAME COLUMN "entity_type_id" TO "entity_type"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" RENAME COLUMN "group_id" TO "group"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" RENAME COLUMN "default_agent_id" TO "default_agent"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" RENAME COLUMN "kyc_risk_category_id" TO "kyc_risk_category"`);
        await queryRunner.query(`ALTER TABLE "branches" RENAME COLUMN "location_type_id" TO "location_type"`);
    }

}
