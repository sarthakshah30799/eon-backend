import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveIsFfmcFieldFromCorporateClients1782000000000 implements MigrationInterface {
    name = 'RemoveIsFfmcFieldFromCorporateClients1782000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "corporate_clients"
                DROP COLUMN IF EXISTS "is_ffmc"
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "corporate_clients"
                ADD COLUMN IF NOT EXISTS "is_ffmc" BOOLEAN NOT NULL DEFAULT false
        `);
    }
}
