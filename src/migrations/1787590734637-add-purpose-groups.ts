import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPurposeGroups1787590734637 implements MigrationInterface {
  name = "AddPurposeGroups1787590734637";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."purpose_groups_profile_type_enum" AS ENUM('FFMC', 'AD')`,
    );
    await queryRunner.query(
      `CREATE TABLE "purpose_groups" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "name" citext NOT NULL, "title" citext NOT NULL, "profile_type" "public"."purpose_groups_profile_type_enum" NOT NULL, "sort_order" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_653a0b6fd80a59fb5219f73e127" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_purpose_groups_profile_type_name" ON "purpose_groups" ("profile_type", "name") `,
    );
    await queryRunner.query(
      `CREATE TABLE "purpose_group_purposes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "purpose_group_id" uuid NOT NULL, "purpose_id" uuid NOT NULL, CONSTRAINT "UQ_purpose_group_purposes_group_purpose" UNIQUE ("purpose_group_id", "purpose_id"), CONSTRAINT "PK_bd489f6a0fca94efcb2bf83a5e7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_purpose_group_purposes_purpose_id" ON "purpose_group_purposes" ("purpose_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_purpose_group_purposes_purpose_group_id" ON "purpose_group_purposes" ("purpose_group_id") `,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."purpose_slabs_rate_type_enum" RENAME TO "purpose_slabs_rate_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."purpose_slabs_rate_type_enum" AS ENUM('PERCENT', 'RUPEES')`,
    );
    await queryRunner.query(
      `ALTER TABLE "purpose_slabs" ALTER COLUMN "rate_type" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "purpose_slabs" ALTER COLUMN "rate_type" TYPE "public"."purpose_slabs_rate_type_enum" USING "rate_type"::"text"::"public"."purpose_slabs_rate_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purpose_slabs" ALTER COLUMN "rate_type" SET DEFAULT 'PERCENT'`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."purpose_slabs_rate_type_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purpose_group_purposes" ADD CONSTRAINT "FK_purpose_group_purposes_purpose_group_id" FOREIGN KEY ("purpose_group_id") REFERENCES "purpose_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purpose_group_purposes" ADD CONSTRAINT "FK_purpose_group_purposes_purpose_id" FOREIGN KEY ("purpose_id") REFERENCES "purposes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "purpose_group_purposes" DROP CONSTRAINT "FK_purpose_group_purposes_purpose_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purpose_group_purposes" DROP CONSTRAINT "FK_purpose_group_purposes_purpose_group_id"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."purpose_slabs_rate_type_enum_old" AS ENUM('PERCENT', 'RUPEES')`,
    );
    await queryRunner.query(
      `ALTER TABLE "purpose_slabs" ALTER COLUMN "rate_type" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "purpose_slabs" ALTER COLUMN "rate_type" TYPE "public"."purpose_slabs_rate_type_enum_old" USING "rate_type"::"text"::"public"."purpose_slabs_rate_type_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purpose_slabs" ALTER COLUMN "rate_type" SET DEFAULT 'PERCENT'`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."purpose_slabs_rate_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."purpose_slabs_rate_type_enum_old" RENAME TO "purpose_slabs_rate_type_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_purpose_group_purposes_purpose_group_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_purpose_group_purposes_purpose_id"`,
    );
    await queryRunner.query(`DROP TABLE "purpose_group_purposes"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_purpose_groups_profile_type_name"`,
    );
    await queryRunner.query(`DROP TABLE "purpose_groups"`);
    await queryRunner.query(
      `DROP TYPE "public"."purpose_groups_profile_type_enum"`,
    );
  }
}
