import { MigrationInterface, QueryRunner } from "typeorm";

export class DropCompanyPanUnique1784465377269 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "company"
            DROP CONSTRAINT IF EXISTS "UQ_9233994e3e400a77bb69a5a42ad"
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "company"
            ADD CONSTRAINT "UQ_9233994e3e400a77bb69a5a42ad" UNIQUE ("pan_no")
        `);
    }

}
