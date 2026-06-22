import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStatusUpdatedByToCorporateClients1782210000000 implements MigrationInterface {
    name = 'AddStatusUpdatedByToCorporateClients1782210000000'

    public async up(queryRunner: QueryRunner): Promise<void> {

        await queryRunner.query(`
            ALTER TABLE "corporate_clients"
                ADD COLUMN IF NOT EXISTS "status_updated_by_id" uuid,
                ADD COLUMN IF NOT EXISTS "status_updated_at" TIMESTAMPTZ
        `);

        await queryRunner.query(`
            ALTER TABLE "corporate_clients"
                ADD CONSTRAINT "FK_corporate_clients_status_updated_by_id"
                FOREIGN KEY ("status_updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "corporate_clients" RENAME TO "party_profiles"
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "party_profiles" RENAME TO "corporate_clients"
        `);
        
        await queryRunner.query(`
            ALTER TABLE "corporate_clients"
                DROP CONSTRAINT IF EXISTS "FK_corporate_clients_status_updated_by_id"
        `);

        await queryRunner.query(`
            ALTER TABLE "corporate_clients"
                DROP COLUMN IF EXISTS "status_updated_at",
                DROP COLUMN IF EXISTS "status_updated_by_id"
        `);
    }
}
