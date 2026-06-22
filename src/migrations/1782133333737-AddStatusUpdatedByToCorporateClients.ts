import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStatusUpdatedByToCorporateClients1782133333737 implements MigrationInterface {
    name = 'AddStatusUpdatedByToCorporateClients1782133333737'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const partyProfilesExists = await queryRunner.hasTable("party_profiles");
        const tableName = partyProfilesExists ? "party_profiles" : "corporate_clients";

        await queryRunner.query(`
            ALTER TABLE "${tableName}"
                ADD COLUMN IF NOT EXISTS "status_updated_by_id" uuid,
                ADD COLUMN IF NOT EXISTS "status_updated_at" TIMESTAMPTZ
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'FK_party_profiles_status_updated_by_id'
                ) THEN
                    EXECUTE 'ALTER TABLE "${tableName}" ADD CONSTRAINT "FK_party_profiles_status_updated_by_id" FOREIGN KEY ("status_updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL';
                END IF;
            END $$;
        `);

        if (!partyProfilesExists) {
            await queryRunner.query(`
                ALTER TABLE "corporate_clients" RENAME TO "party_profiles"
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const partyProfilesExists = await queryRunner.hasTable("party_profiles");
        const tableName = partyProfilesExists ? "party_profiles" : "corporate_clients";

        await queryRunner.query(`
            ALTER TABLE "${tableName}"
                DROP CONSTRAINT IF EXISTS "FK_party_profiles_status_updated_by_id"
        `);

        await queryRunner.query(`
            ALTER TABLE "${tableName}"
                DROP COLUMN IF EXISTS "status_updated_at",
                DROP COLUMN IF EXISTS "status_updated_by_id"
        `);

        if (partyProfilesExists) {
            await queryRunner.query(`
                ALTER TABLE "party_profiles" RENAME TO "corporate_clients"
            `);
        }
    }
}
