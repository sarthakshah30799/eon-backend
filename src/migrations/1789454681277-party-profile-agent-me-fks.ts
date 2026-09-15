import { MigrationInterface, QueryRunner } from "typeorm";

export class PartyProfileAgentMeFks1789454681277 implements MigrationInterface {
    name = 'PartyProfileAgentMeFks1789454681277'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP CONSTRAINT "FK_party_profiles_defaultAgent"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP CONSTRAINT "FK_party_profiles_marketingExecutive"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_purpose_groups_profile_type_name"`);
        await queryRunner.query(`ALTER TYPE "public"."purpose_groups_profile_type_enum" RENAME TO "purpose_groups_profile_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."purpose_groups_profile_type_enum" AS ENUM('FFMC', 'AD')`);
        await queryRunner.query(`ALTER TABLE "purpose_groups" ALTER COLUMN "profile_type" TYPE "public"."purpose_groups_profile_type_enum" USING "profile_type"::"text"::"public"."purpose_groups_profile_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."purpose_groups_profile_type_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."purpose_slabs_rate_type_enum" RENAME TO "purpose_slabs_rate_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."purpose_slabs_rate_type_enum" AS ENUM('PERCENT', 'RUPEES')`);
        await queryRunner.query(`ALTER TABLE "purpose_slabs" ALTER COLUMN "rate_type" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "purpose_slabs" ALTER COLUMN "rate_type" TYPE "public"."purpose_slabs_rate_type_enum" USING "rate_type"::"text"::"public"."purpose_slabs_rate_type_enum"`);
        await queryRunner.query(`ALTER TABLE "purpose_slabs" ALTER COLUMN "rate_type" SET DEFAULT 'PERCENT'`);
        await queryRunner.query(`DROP TYPE "public"."purpose_slabs_rate_type_enum_old"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_purpose_groups_profile_type_name" ON "purpose_groups" ("profile_type", "name") `);
        // Old values pointed at category_options; clear orphans before self-FK.
        await queryRunner.query(`
            UPDATE "party_profiles" pp
            SET "default_agent_id" = NULL
            WHERE "default_agent_id" IS NOT NULL
              AND NOT EXISTS (
                SELECT 1 FROM "party_profiles" agent WHERE agent."id" = pp."default_agent_id"
              )
        `);
        await queryRunner.query(`
            UPDATE "party_profiles" pp
            SET "marketing_executive_id" = NULL
            WHERE "marketing_executive_id" IS NOT NULL
              AND NOT EXISTS (
                SELECT 1 FROM "party_profiles" me WHERE me."id" = pp."marketing_executive_id"
              )
        `);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD CONSTRAINT "FK_party_profiles_defaultAgent" FOREIGN KEY ("default_agent_id") REFERENCES "party_profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD CONSTRAINT "FK_party_profiles_marketingExecutive" FOREIGN KEY ("marketing_executive_id") REFERENCES "party_profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP CONSTRAINT "FK_party_profiles_marketingExecutive"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP CONSTRAINT "FK_party_profiles_defaultAgent"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_purpose_groups_profile_type_name"`);
        await queryRunner.query(`CREATE TYPE "public"."purpose_slabs_rate_type_enum_old" AS ENUM('PERCENT', 'RUPEES')`);
        await queryRunner.query(`ALTER TABLE "purpose_slabs" ALTER COLUMN "rate_type" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "purpose_slabs" ALTER COLUMN "rate_type" TYPE "public"."purpose_slabs_rate_type_enum_old" USING "rate_type"::"text"::"public"."purpose_slabs_rate_type_enum_old"`);
        await queryRunner.query(`ALTER TABLE "purpose_slabs" ALTER COLUMN "rate_type" SET DEFAULT 'PERCENT'`);
        await queryRunner.query(`DROP TYPE "public"."purpose_slabs_rate_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."purpose_slabs_rate_type_enum_old" RENAME TO "purpose_slabs_rate_type_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."purpose_groups_profile_type_enum_old" AS ENUM('FFMC', 'AD')`);
        await queryRunner.query(`ALTER TABLE "purpose_groups" ALTER COLUMN "profile_type" TYPE "public"."purpose_groups_profile_type_enum_old" USING "profile_type"::"text"::"public"."purpose_groups_profile_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."purpose_groups_profile_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."purpose_groups_profile_type_enum_old" RENAME TO "purpose_groups_profile_type_enum"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_purpose_groups_profile_type_name" ON "purpose_groups" ("name", "profile_type") `);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD CONSTRAINT "FK_party_profiles_marketingExecutive" FOREIGN KEY ("marketing_executive_id") REFERENCES "category_options"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD CONSTRAINT "FK_party_profiles_defaultAgent" FOREIGN KEY ("default_agent_id") REFERENCES "category_options"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

}
