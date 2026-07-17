import { MigrationInterface, QueryRunner } from "typeorm";

export class SyncTablesConstraint1784269562171 implements MigrationInterface {
  name = "SyncTablesConstraint1784269562171";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "financial_codes" DROP CONSTRAINT IF EXISTS "financial_codes_default_sign_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "financial_codes" DROP CONSTRAINT IF EXISTS "financial_codes_financial_type_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "financial_codes" ADD CONSTRAINT "FK_financial_codes_financialType" FOREIGN KEY ("financial_type_id") REFERENCES "category_options"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "financial_codes" ADD CONSTRAINT "FK_financial_codes_defaultSign" FOREIGN KEY ("default_sign_id") REFERENCES "category_options"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "financial_codes" DROP CONSTRAINT IF EXISTS "FK_financial_codes_defaultSign"`,
    );
    await queryRunner.query(
      `ALTER TABLE "financial_codes" DROP CONSTRAINT IF EXISTS "FK_financial_codes_financialType"`,
    );
    await queryRunner.query(
      `ALTER TABLE "financial_codes" ADD CONSTRAINT "financial_codes_financial_type_id_fkey" FOREIGN KEY ("financial_type_id") REFERENCES "category_options"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "financial_codes" ADD CONSTRAINT "financial_codes_default_sign_fkey" FOREIGN KEY ("default_sign_id") REFERENCES "category_options"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }
}
