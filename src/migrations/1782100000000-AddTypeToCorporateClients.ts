import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTypeToCorporateClients1782100000000 implements MigrationInterface {
    name = 'AddTypeToCorporateClients1782100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "corporate_clients"
                ADD COLUMN IF NOT EXISTS "type" VARCHAR NOT NULL DEFAULT 'corporate_client'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "corporate_clients"
                DROP COLUMN IF EXISTS "type"
        `);
    }
}
