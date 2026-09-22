import { MigrationInterface, QueryRunner } from "typeorm";

export class PartyProfileManyToManyBranchRelation1790080261889 implements MigrationInterface {
    name = 'PartyProfileManyToManyBranchRelation1790080261889'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP CONSTRAINT "FK_party_profiles_branch_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_party_profiles_branch_id"`);
        await queryRunner.query(`CREATE TABLE "party_profile_branches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "party_profile_id" uuid NOT NULL, "branch_id" uuid NOT NULL, CONSTRAINT "UQ_party_profile_branches_party_profile_branch" UNIQUE ("party_profile_id", "branch_id"), CONSTRAINT "PK_159dc0e1be61d63b8e393fe8e05" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_party_profile_branches_branch_id" ON "party_profile_branches" ("branch_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_party_profile_branches_party_profile_id" ON "party_profile_branches" ("party_profile_id") `);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "branch_id"`);
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
        await queryRunner.query(`ALTER TABLE "party_profile_branches" ADD CONSTRAINT "FK_4d30dc7f774036fb880e871da3b" FOREIGN KEY ("party_profile_id") REFERENCES "party_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "party_profile_branches" ADD CONSTRAINT "FK_9e8b7b8d121a9fedf7e14b97d56" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "party_profile_branches" DROP CONSTRAINT "FK_9e8b7b8d121a9fedf7e14b97d56"`);
        await queryRunner.query(`ALTER TABLE "party_profile_branches" DROP CONSTRAINT "FK_4d30dc7f774036fb880e871da3b"`);
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
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "branch_id" uuid`);
        await queryRunner.query(`DROP INDEX "public"."IDX_party_profile_branches_party_profile_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_party_profile_branches_branch_id"`);
        await queryRunner.query(`DROP TABLE "party_profile_branches"`);
        await queryRunner.query(`CREATE INDEX "IDX_party_profiles_branch_id" ON "party_profiles" ("branch_id") `);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD CONSTRAINT "FK_party_profiles_branch_id" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

}
