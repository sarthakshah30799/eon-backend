import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDivFactor1782498297852 implements MigrationInterface {
    name = 'AddDivFactor1782498297852'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "division_factor" numeric(15,2)`);
        await queryRunner.query(`ALTER TABLE "document_profiles" ADD "financial_year_selection" uuid`);
        await queryRunner.query(`ALTER TABLE "document_profiles" ADD CONSTRAINT "FK_0bdeda903d507cd1d2d52c746fd" FOREIGN KEY ("financial_year_selection") REFERENCES "category_options"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "document_profiles" DROP CONSTRAINT "FK_0bdeda903d507cd1d2d52c746fd"`);
        await queryRunner.query(`ALTER TABLE "document_profiles" DROP COLUMN "financial_year_selection"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "division_factor"`);
    }

}
