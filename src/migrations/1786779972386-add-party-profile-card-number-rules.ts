import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPartyProfileCardNumberRules1786779972386 implements MigrationInterface {
  name = "AddPartyProfileCardNumberRules1786779972386";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "party_profiles" ADD "card_number_length" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "party_profiles" ADD "allow_card_number_masking" boolean NOT NULL DEFAULT false`,
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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
      `ALTER TABLE "party_profiles" DROP COLUMN "allow_card_number_masking"`,
    );
    await queryRunner.query(
      `ALTER TABLE "party_profiles" DROP COLUMN "card_number_length"`,
    );
  }
}
