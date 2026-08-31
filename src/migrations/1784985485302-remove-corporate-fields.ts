import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveCorporateFields1784985485302 implements MigrationInterface {
  name = "RemoveCorporateFields1784985485302";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_passengers_corporate_pan_number"`,
    );
    await queryRunner.query(
      `ALTER TABLE "passengers" DROP CONSTRAINT "CHK_passengers_corporate_pan_holder_present"`,
    );
    await queryRunner.query(
      `ALTER TABLE "passengers" DROP COLUMN "corporate_pan_number"`,
    );
    await queryRunner.query(
      `ALTER TABLE "passengers" DROP COLUMN "corporate_pan_holder_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "passengers" DROP COLUMN "corporate_pan_dob"`,
    );
    await queryRunner.query(
      `ALTER TABLE "passengers" DROP COLUMN "corporate_pan_holder_relation_type"`,
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
      `ALTER TYPE "public"."purposes_rate_type_enum" RENAME TO "purposes_rate_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."purpose_rate_type_enum" AS ENUM('PERCENT', 'RUPEES')`,
    );
    await queryRunner.query(
      `ALTER TABLE "purposes" ALTER COLUMN "rate_type" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "purposes" ALTER COLUMN "rate_type" TYPE "public"."purpose_rate_type_enum" USING "rate_type"::"text"::"public"."purpose_rate_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purposes" ALTER COLUMN "rate_type" SET DEFAULT 'PERCENT'`,
    );
    await queryRunner.query(`DROP TYPE "public"."purposes_rate_type_enum_old"`);
    await queryRunner.query(
      `ALTER TABLE "party_profile_commission_rules" ALTER COLUMN "commission_value" TYPE numeric(18,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "party_profile_commission_rules" ALTER COLUMN "commission_value" TYPE numeric(18,4)`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."purposes_rate_type_enum_old" AS ENUM('PERCENT', 'RUPEES')`,
    );
    await queryRunner.query(
      `ALTER TABLE "purposes" ALTER COLUMN "rate_type" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "purposes" ALTER COLUMN "rate_type" TYPE "public"."purposes_rate_type_enum_old" USING "rate_type"::"text"::"public"."purposes_rate_type_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purposes" ALTER COLUMN "rate_type" SET DEFAULT 'PERCENT'`,
    );
    await queryRunner.query(`DROP TYPE "public"."purpose_rate_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."purposes_rate_type_enum_old" RENAME TO "purposes_rate_type_enum"`,
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
      `ALTER TABLE "passengers" ADD "corporate_pan_holder_relation_type" citext`,
    );
    await queryRunner.query(
      `ALTER TABLE "passengers" ADD "corporate_pan_dob" date`,
    );
    await queryRunner.query(
      `ALTER TABLE "passengers" ADD "corporate_pan_holder_name" citext`,
    );
    await queryRunner.query(
      `ALTER TABLE "passengers" ADD "corporate_pan_number" citext`,
    );
    await queryRunner.query(
      `ALTER TABLE "passengers" ADD CONSTRAINT "CHK_passengers_corporate_pan_holder_present" CHECK (((corporate_pan_number IS NULL) OR (corporate_pan_holder_name IS NOT NULL)))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_passengers_corporate_pan_number" ON "passengers" ("corporate_pan_number") `,
    );
  }
}
