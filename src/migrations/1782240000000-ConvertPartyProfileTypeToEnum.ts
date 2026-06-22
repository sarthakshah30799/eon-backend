import { MigrationInterface, QueryRunner } from "typeorm";

export class ConvertPartyProfileTypeToEnum1782240000000 implements MigrationInterface {
    name = 'ConvertPartyProfileTypeToEnum1782240000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE "party_profiles"
            SET "type" = UPPER("type")
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                CREATE TYPE "public"."party_profiles_type_enum" AS ENUM (
                    'CORPORATE_CLIENT',
                    'FFMC',
                    'AUTHORISED_DEALER',
                    'RMC',
                    'FRANCHISE',
                    'AGENT',
                    'FOREIGN_CORRESPONDENT',
                    'MARKETING_EXECUTIVE',
                    'CARD_ISSUER_PROFILE',
                    'MISC_PROFILE'
                );
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END $$;
        `);

        await queryRunner.query(`
            ALTER TABLE "party_profiles"
                ALTER COLUMN "type" DROP DEFAULT
        `);

        await queryRunner.query(`
            ALTER TABLE "party_profiles"
                ALTER COLUMN "type" TYPE "public"."party_profiles_type_enum"
                USING "type"::"public"."party_profiles_type_enum"
        `);

        await queryRunner.query(`
            ALTER TABLE "party_profiles"
                ALTER COLUMN "type" SET DEFAULT 'CORPORATE_CLIENT'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "party_profiles"
                ALTER COLUMN "type" DROP DEFAULT
        `);

        await queryRunner.query(`
            ALTER TABLE "party_profiles"
                ALTER COLUMN "type" TYPE varchar
                USING LOWER("type"::text)
        `);

        await queryRunner.query(`
            ALTER TABLE "party_profiles"
                ALTER COLUMN "type" SET DEFAULT 'corporate_client'
        `);

        await queryRunner.query(`
            DROP TYPE IF EXISTS "public"."party_profiles_type_enum"
        `);
    }
}
