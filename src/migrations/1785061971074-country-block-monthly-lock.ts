import { MigrationInterface, QueryRunner } from "typeorm";

export class CountryBlockMonthlyLock1785061971074 implements MigrationInterface {
  name = "CountryBlockMonthlyLock1785061971074";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "unblock_country_access" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "country_id" uuid NOT NULL, "branch_id" uuid NOT NULL, "user_id" uuid NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "revoked_at" TIMESTAMP WITH TIME ZONE, "revoked_by" uuid, CONSTRAINT "PK_50404388b65ac5918b90a93676e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_unblock_country_access_country_branch_user" ON "unblock_country_access" ("country_id", "branch_id", "user_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "countries" ADD "is_blocked" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "countries" ADD "blocked_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(`ALTER TABLE "countries" ADD "blocked_by_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "countries" ADD "blocked_reason" text`,
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
      `ALTER TYPE "public"."purpose_rate_type_enum" RENAME TO "purpose_rate_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."purposes_rate_type_enum" AS ENUM('PERCENT', 'RUPEES')`,
    );
    await queryRunner.query(
      `ALTER TABLE "purposes" ALTER COLUMN "rate_type" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "purposes" ALTER COLUMN "rate_type" TYPE "public"."purposes_rate_type_enum" USING "rate_type"::"text"::"public"."purposes_rate_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purposes" ALTER COLUMN "rate_type" SET DEFAULT 'PERCENT'`,
    );
    await queryRunner.query(`DROP TYPE "public"."purpose_rate_type_enum_old"`);
    await queryRunner.query(
      `ALTER TABLE "unblock_country_access" ADD CONSTRAINT "FK_unblock_country_access_country_id" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "unblock_country_access" ADD CONSTRAINT "FK_unblock_country_access_branch_id" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "unblock_country_access" ADD CONSTRAINT "FK_unblock_country_access_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "countries" ADD CONSTRAINT "FK_countries_blocked_by_id" FOREIGN KEY ("blocked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "countries" DROP CONSTRAINT "FK_countries_blocked_by_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "unblock_country_access" DROP CONSTRAINT "FK_unblock_country_access_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "unblock_country_access" DROP CONSTRAINT "FK_unblock_country_access_branch_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "unblock_country_access" DROP CONSTRAINT "FK_unblock_country_access_country_id"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."purpose_rate_type_enum_old" AS ENUM('PERCENT', 'RUPEES')`,
    );
    await queryRunner.query(
      `ALTER TABLE "purposes" ALTER COLUMN "rate_type" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "purposes" ALTER COLUMN "rate_type" TYPE "public"."purpose_rate_type_enum_old" USING "rate_type"::"text"::"public"."purpose_rate_type_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purposes" ALTER COLUMN "rate_type" SET DEFAULT 'PERCENT'`,
    );
    await queryRunner.query(`DROP TYPE "public"."purposes_rate_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."purpose_rate_type_enum_old" RENAME TO "purpose_rate_type_enum"`,
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
      `ALTER TABLE "countries" DROP COLUMN "blocked_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "countries" DROP COLUMN "blocked_by_id"`,
    );
    await queryRunner.query(`ALTER TABLE "countries" DROP COLUMN "blocked_at"`);
    await queryRunner.query(`ALTER TABLE "countries" DROP COLUMN "is_blocked"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_unblock_country_access_country_branch_user"`,
    );
    await queryRunner.query(`DROP TABLE "unblock_country_access"`);
  }
}
