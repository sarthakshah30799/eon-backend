import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFfmcFieldsToCorporateClients1781030000000 implements MigrationInterface {
    name = 'AddFfmcFieldsToCorporateClients1781030000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "corporate_clients"
                ADD COLUMN IF NOT EXISTS "is_ffmc"      BOOLEAN       NOT NULL DEFAULT false,
                ADD COLUMN IF NOT EXISTS "ffmc_reg_no"  CITEXT        NULL,
                ADD COLUMN IF NOT EXISTS "ffmc_reg_date" TIMESTAMPTZ  NULL
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "corporate_clients"
                DROP COLUMN IF EXISTS "ffmc_reg_date",
                DROP COLUMN IF EXISTS "ffmc_reg_no",
                DROP COLUMN IF EXISTS "is_ffmc"
        `);
    }
}
