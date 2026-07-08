import { MigrationInterface, QueryRunner } from "typeorm";

export class UppercaseCategoryOptions1782309658052 implements MigrationInterface {
    name = 'UppercaseCategoryOptions1782309658052'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "category_options"
            SET
              "code" = UPPER(REPLACE("code", '_', '')),
              "value" = UPPER("value"),
              "label" = UPPER("label")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "category_options"
            SET
              "code" = CASE
                WHEN "code" = 'LOCATIONTYPE' THEN 'locationType'
                WHEN "code" = 'RISKCATEGORY' THEN 'riskCategory'
                WHEN "code" = 'FINANCIALTYPE' THEN 'financialType'
                WHEN "code" = 'DEFAULTSIGN' THEN 'defaultSign'
                WHEN "code" = 'DIVISIONDEPT' THEN 'divisionDept'
                WHEN "code" = 'ACCOUNTTYPE' THEN 'accountType'
                WHEN "code" = 'SUBLEDGER' THEN 'subLedger'
                WHEN "code" = 'BANKNATURE' THEN 'bankNature'
                WHEN "code" = 'KYCRISKCATEGORY' THEN 'kycRiskCategory'
                WHEN "code" = 'ENTITYTYPE' THEN 'entityType'
                WHEN "code" = 'DEFAULTAGENT' THEN 'defaultAgent'
                WHEN "code" = 'GROUP' THEN 'group'
                WHEN "code" = 'DOCUMENTGROUP' THEN 'documentGroup'
                WHEN "code" = 'MARKETINGEXECUTIVE' THEN 'marketingExecutive'
                WHEN "code" = 'BUSINESSNATURE' THEN 'businessNature'
                WHEN "code" = 'TDSGROUP' THEN 'tdsGroup'
                WHEN "code" = 'FFMCGROUP' THEN 'ffmcGroup'
                WHEN "code" = 'MASTER' THEN 'masterDocument'
                WHEN "code" = 'TRANSACTION' THEN 'transactionDocument'
                ELSE LOWER("code")
              END,
              "value" = LOWER("value"),
              "label" = LOWER("label")
        `);
    }
}
