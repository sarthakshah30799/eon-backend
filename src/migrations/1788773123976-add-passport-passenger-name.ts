import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPassportPassengerName1788773123976 implements MigrationInterface {
    name = 'AddPassportPassengerName1788773123976'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "passengers" ADD "passport_passenger_name" citext`);
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
        await queryRunner.query(`ALTER TABLE "passengers" ADD CONSTRAINT "CHK_passengers_passport_passenger_name_present" CHECK ("passport_number" IS NULL OR "passport_passenger_name" IS NOT NULL)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "passengers" DROP CONSTRAINT "CHK_passengers_passport_passenger_name_present"`);
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
        await queryRunner.query(`ALTER TABLE "passengers" DROP COLUMN "passport_passenger_name"`);
    }

}
