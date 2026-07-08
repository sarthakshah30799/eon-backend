import { MigrationInterface, QueryRunner } from "typeorm";

export class StatusChangeLogs1782141169722 implements MigrationInterface {
    name = 'StatusChangeLogs1782141169722'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP CONSTRAINT IF EXISTS "FK_party_profiles_status_updated_by_id"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP CONSTRAINT IF EXISTS "FK_corporate_clients_status_updated_by_id"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP CONSTRAINT IF EXISTS "FK_1ca6a8ada551d33f372adfca0f5"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP CONSTRAINT IF EXISTS "FK_0b0e30b37f4fb74c221872d8588"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_0ece6ef150343e4987308d300f"`);
        await queryRunner.query(`CREATE TYPE "public"."party_profile_status_change_logs_status_enum" AS ENUM('pending', 'approve', 'reject')`);
        await queryRunner.query(`CREATE TABLE "party_profile_status_change_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "party_profile_id" uuid NOT NULL, "status" "public"."party_profile_status_change_logs_status_enum" NOT NULL, "active_after_review" boolean NOT NULL, "reject_reason" text, "reviewed_by_id" uuid, "reviewed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_57d7a58454783cdc5fd8a116383" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_93f4a3d18c64216f56b7c15eb7" ON "party_profile_status_change_logs" ("party_profile_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_2859fbabbe5fe3fa21b0235251" ON "party_profile_status_change_logs" ("reviewed_by_id") `);
        await queryRunner.query(`ALTER TYPE "public"."entity_status_enum" RENAME TO "entity_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."party_profiles_status_enum" AS ENUM('pending', 'approve', 'reject')`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ALTER COLUMN "status" TYPE "public"."party_profiles_status_enum" USING "status"::"text"::"public"."party_profiles_status_enum"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ALTER COLUMN "status" SET DEFAULT 'pending'`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ALTER COLUMN "active" SET DEFAULT false`);
        await queryRunner.query(`DROP TYPE "public"."entity_status_enum_old"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_947d9c90afe400decdc45f1a2f" ON "party_profiles" ("code") `);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD CONSTRAINT "FK_party_profiles_status_updated_by_id" FOREIGN KEY ("status_updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD CONSTRAINT "FK_party_profiles_gst_state_id" FOREIGN KEY ("gst_state_id") REFERENCES "states"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD CONSTRAINT "FK_party_profiles_origin_branch_id" FOREIGN KEY ("origin_branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "party_profile_status_change_logs" ADD CONSTRAINT "FK_party_profile_status_change_logs_party_profile_id" FOREIGN KEY ("party_profile_id") REFERENCES "party_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "party_profile_status_change_logs" ADD CONSTRAINT "FK_party_profile_status_change_logs_reviewed_by_id" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "party_profile_status_change_logs" DROP CONSTRAINT IF EXISTS "FK_party_profile_status_change_logs_reviewed_by_id"`);
        await queryRunner.query(`ALTER TABLE "party_profile_status_change_logs" DROP CONSTRAINT IF EXISTS "FK_party_profile_status_change_logs_party_profile_id"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP CONSTRAINT IF EXISTS "FK_party_profiles_origin_branch_id"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP CONSTRAINT IF EXISTS "FK_party_profiles_gst_state_id"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP CONSTRAINT IF EXISTS "FK_party_profiles_status_updated_by_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_947d9c90afe400decdc45f1a2f"`);
        await queryRunner.query(`CREATE TYPE "public"."entity_status_enum_old" AS ENUM('pending', 'approve', 'reject')`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ALTER COLUMN "status" TYPE "public"."entity_status_enum_old" USING "status"::"text"::"public"."entity_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ALTER COLUMN "status" SET DEFAULT 'pending'`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ALTER COLUMN "active" SET DEFAULT true`);
        await queryRunner.query(`DROP TYPE "public"."party_profiles_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."entity_status_enum_old" RENAME TO "entity_status_enum"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_2859fbabbe5fe3fa21b0235251"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_93f4a3d18c64216f56b7c15eb7"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "party_profile_status_change_logs"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."party_profile_status_change_logs_status_enum"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0ece6ef150343e4987308d300f" ON "party_profiles" ("code") `);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD CONSTRAINT "FK_0b0e30b37f4fb74c221872d8588" FOREIGN KEY ("gst_state_id") REFERENCES "states"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD CONSTRAINT "FK_1ca6a8ada551d33f372adfca0f5" FOREIGN KEY ("origin_branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD CONSTRAINT "FK_corporate_clients_status_updated_by_id" FOREIGN KEY ("status_updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD CONSTRAINT "FK_party_profiles_status_updated_by_id" FOREIGN KEY ("status_updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

}
