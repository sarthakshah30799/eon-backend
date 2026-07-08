import { MigrationInterface, QueryRunner } from "typeorm";

export class DocumentProfileSpecificationTypeEnum1782287107136 implements MigrationInterface {
    name = 'DocumentProfileSpecificationTypeEnum1782287107136'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."party_profiles_type_enum" RENAME TO "party_profiles_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."party_profiles_type_enum" AS ENUM('CORPORATE_CLIENT', 'FFMC', 'RF', 'AUTHORISED_DEALER', 'RMC', 'FRANCHISE', 'AGENT', 'FOREIGN_CORRESPONDENT', 'MARKETING_EXECUTIVE', 'CARD_ISSUER_PROFILE', 'MISC_PROFILE')`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ALTER COLUMN "type" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ALTER COLUMN "type" TYPE "public"."party_profiles_type_enum" USING "type"::"text"::"public"."party_profiles_type_enum"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ALTER COLUMN "type" SET DEFAULT 'CORPORATE_CLIENT'`);
        await queryRunner.query(`DROP TYPE "public"."party_profiles_type_enum_old"`);
        await queryRunner.query(`ALTER TABLE "document_profiles" DROP COLUMN "specification_type"`);
        await queryRunner.query(`CREATE TYPE "public"."document_profiles_specification_type_enum" AS ENUM('MASTER', 'TRANSACTION')`);
        await queryRunner.query(`ALTER TABLE "document_profiles" ADD "specification_type" "public"."document_profiles_specification_type_enum" NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "document_profiles" DROP COLUMN "specification_type"`);
        await queryRunner.query(`DROP TYPE "public"."document_profiles_specification_type_enum"`);
        await queryRunner.query(`ALTER TABLE "document_profiles" ADD "specification_type" uuid NOT NULL`);
        await queryRunner.query(`CREATE TYPE "public"."party_profiles_type_enum_old" AS ENUM('CORPORATE_CLIENT', 'FFMC', 'AUTHORISED_DEALER', 'RMC', 'FRANCHISE', 'AGENT', 'FOREIGN_CORRESPONDENT', 'MARKETING_EXECUTIVE', 'CARD_ISSUER_PROFILE', 'MISC_PROFILE')`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ALTER COLUMN "type" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ALTER COLUMN "type" TYPE "public"."party_profiles_type_enum_old" USING "type"::"text"::"public"."party_profiles_type_enum_old"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ALTER COLUMN "type" SET DEFAULT 'CORPORATE_CLIENT'`);
        await queryRunner.query(`DROP TYPE "public"."party_profiles_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."party_profiles_type_enum_old" RENAME TO "party_profiles_type_enum"`);
    }

}
