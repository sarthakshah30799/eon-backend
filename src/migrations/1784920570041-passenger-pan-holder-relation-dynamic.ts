import { MigrationInterface, QueryRunner } from "typeorm";

export class PassengerPanHolderRelationDynamic1784920570041 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "passengers" ALTER COLUMN "pan_holder_relation_type" TYPE citext USING CASE WHEN "pan_holder_relation_type" IS NULL THEN NULL ELSE "pan_holder_relation_type"::text END`);
        await queryRunner.query(`ALTER TABLE "passengers" ALTER COLUMN "corporate_pan_holder_relation_type" TYPE citext USING CASE WHEN "corporate_pan_holder_relation_type" IS NULL THEN NULL ELSE "corporate_pan_holder_relation_type"::text END`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."passengers_pan_holder_relation_type_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."passengers_corporate_pan_holder_relation_type_enum"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."passengers_pan_holder_relation_type_enum" AS ENUM('COMPANY', 'INDIVIDUAL')`);
        await queryRunner.query(`CREATE TYPE "public"."passengers_corporate_pan_holder_relation_type_enum" AS ENUM('COMPANY', 'INDIVIDUAL')`);
        await queryRunner.query(`ALTER TABLE "passengers" ALTER COLUMN "corporate_pan_holder_relation_type" TYPE "public"."passengers_corporate_pan_holder_relation_type_enum" USING CASE WHEN "corporate_pan_holder_relation_type" IS NULL THEN NULL ELSE "corporate_pan_holder_relation_type"::text::"public"."passengers_corporate_pan_holder_relation_type_enum" END`);
        await queryRunner.query(`ALTER TABLE "passengers" ALTER COLUMN "pan_holder_relation_type" TYPE "public"."passengers_pan_holder_relation_type_enum" USING CASE WHEN "pan_holder_relation_type" IS NULL THEN NULL ELSE "pan_holder_relation_type"::text::"public"."passengers_pan_holder_relation_type_enum" END`);
    }

}
