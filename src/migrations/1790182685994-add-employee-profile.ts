import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEmployeeProfile1790182685994 implements MigrationInterface {
    name = 'AddEmployeeProfile1790182685994'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "date_of_joining" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "date_of_exit" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "basic_salary" numeric(15,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "net_salary" numeric(15,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "dareness" numeric(15,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "house_rent" numeric(15,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "conveyance" numeric(15,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "special_allowance" numeric(15,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "other_allowance" numeric(15,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "allowance_total" numeric(15,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "pf" numeric(15,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "ppf" numeric(15,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "p_tax" numeric(15,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "esic" numeric(15,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "income_tax" numeric(15,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "other_deduction" numeric(15,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "deduction_total" numeric(15,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TYPE "public"."party_profiles_type_enum" RENAME TO "party_profiles_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."party_profiles_type_enum" AS ENUM('CORPORATE_CLIENT', 'FFMC', 'RF', 'AUTHORISED_DEALER', 'RMC', 'FRANCHISE', 'AGENT', 'FOREIGN_CORRESPONDENT', 'FOREX_CORRESPONDENT', 'MARKETING_EXECUTIVE', 'CARD_ISSUER_PROFILE', 'MISC_PROFILE', 'EMPLOYEE_PROFILE')`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ALTER COLUMN "type" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ALTER COLUMN "type" TYPE "public"."party_profiles_type_enum" USING "type"::"text"::"public"."party_profiles_type_enum"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ALTER COLUMN "type" SET DEFAULT 'CORPORATE_CLIENT'`);
        await queryRunner.query(`DROP TYPE "public"."party_profiles_type_enum_old"`);
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
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."UQ_purpose_groups_profile_type_name"`);
        await queryRunner.query(`CREATE TYPE "public"."purpose_slabs_rate_type_enum_old" AS ENUM('PERCENT', 'RUPEES')`);
        await queryRunner.query(`ALTER TABLE "purpose_slabs" ALTER COLUMN "rate_type" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "purpose_slabs" ALTER COLUMN "rate_type" TYPE "public"."purpose_slabs_rate_type_enum_old" USING "rate_type"::"text"::"public"."purpose_slabs_rate_type_enum_old"`);
        await queryRunner.query(`ALTER TABLE "purpose_slabs" ALTER COLUMN "rate_type" SET DEFAULT 'PERCENT'`);
        await queryRunner.query(`DROP TYPE "public"."purpose_slabs_rate_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."purpose_slabs_rate_type_enum_old" RENAME TO "purpose_slabs_rate_type_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."purpose_groups_profile_type_enum_old" AS ENUM('AD', 'FFMC')`);
        await queryRunner.query(`ALTER TABLE "purpose_groups" ALTER COLUMN "profile_type" TYPE "public"."purpose_groups_profile_type_enum_old" USING "profile_type"::"text"::"public"."purpose_groups_profile_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."purpose_groups_profile_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."purpose_groups_profile_type_enum_old" RENAME TO "purpose_groups_profile_type_enum"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_purpose_groups_profile_type_name" ON "purpose_groups" ("name", "profile_type") `);
        await queryRunner.query(`CREATE TYPE "public"."party_profiles_type_enum_old" AS ENUM('AGENT', 'AUTHORISED_DEALER', 'CARD_ISSUER_PROFILE', 'CORPORATE_CLIENT', 'FFMC', 'FOREIGN_CORRESPONDENT', 'FOREX_CORRESPONDENT', 'FRANCHISE', 'MARKETING_EXECUTIVE', 'MISC_PROFILE', 'RF', 'RMC')`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ALTER COLUMN "type" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ALTER COLUMN "type" TYPE "public"."party_profiles_type_enum_old" USING "type"::"text"::"public"."party_profiles_type_enum_old"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ALTER COLUMN "type" SET DEFAULT 'CORPORATE_CLIENT'`);
        await queryRunner.query(`DROP TYPE "public"."party_profiles_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."party_profiles_type_enum_old" RENAME TO "party_profiles_type_enum"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "deduction_total"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "other_deduction"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "income_tax"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "esic"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "p_tax"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "ppf"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "pf"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "allowance_total"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "other_allowance"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "special_allowance"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "conveyance"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "house_rent"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "dareness"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "net_salary"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "basic_salary"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "date_of_exit"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "date_of_joining"`);
    }

}
