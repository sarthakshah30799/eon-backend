import { MigrationInterface, QueryRunner } from "typeorm";

export class StatusToUppercase1782195194175 implements MigrationInterface {
    name = 'StatusToUppercase1782195194175'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."party_profiles_status_enum" RENAME TO "party_profiles_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."party_profiles_status_enum" AS ENUM('PENDING', 'APPROVE', 'REJECT')`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`
            ALTER TABLE "party_profiles"
            ALTER COLUMN "status" TYPE "public"."party_profiles_status_enum"
            USING (
                CASE "status"::text
                    WHEN 'pending' THEN 'PENDING'
                    WHEN 'approve' THEN 'APPROVE'
                    WHEN 'reject' THEN 'REJECT'
                    ELSE UPPER("status"::text)
                END
            )::"public"."party_profiles_status_enum"
        `);
        await queryRunner.query(`ALTER TABLE "party_profiles" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."party_profiles_status_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."party_profile_status_change_logs_status_enum" RENAME TO "party_profile_status_change_logs_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."party_profile_status_change_logs_status_enum" AS ENUM('PENDING', 'APPROVE', 'REJECT')`);
        await queryRunner.query(`
            ALTER TABLE "party_profile_status_change_logs"
            ALTER COLUMN "status" TYPE "public"."party_profile_status_change_logs_status_enum"
            USING (
                CASE "status"::text
                    WHEN 'pending' THEN 'PENDING'
                    WHEN 'approve' THEN 'APPROVE'
                    WHEN 'reject' THEN 'REJECT'
                    ELSE UPPER("status"::text)
                END
            )::"public"."party_profile_status_change_logs_status_enum"
        `);
        await queryRunner.query(`DROP TYPE "public"."party_profile_status_change_logs_status_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."party_profile_status_change_logs_status_enum_old" AS ENUM('pending', 'approve', 'reject')`);
        await queryRunner.query(`
            ALTER TABLE "party_profile_status_change_logs"
            ALTER COLUMN "status" TYPE "public"."party_profile_status_change_logs_status_enum_old"
            USING (
                CASE "status"::text
                    WHEN 'PENDING' THEN 'pending'
                    WHEN 'APPROVE' THEN 'approve'
                    WHEN 'REJECT' THEN 'reject'
                    ELSE LOWER("status"::text)
                END
            )::"public"."party_profile_status_change_logs_status_enum_old"
        `);
        await queryRunner.query(`DROP TYPE "public"."party_profile_status_change_logs_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."party_profile_status_change_logs_status_enum_old" RENAME TO "party_profile_status_change_logs_status_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."party_profiles_status_enum_old" AS ENUM('pending', 'approve', 'reject')`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`
            ALTER TABLE "party_profiles"
            ALTER COLUMN "status" TYPE "public"."party_profiles_status_enum_old"
            USING (
                CASE "status"::text
                    WHEN 'PENDING' THEN 'pending'
                    WHEN 'APPROVE' THEN 'approve'
                    WHEN 'REJECT' THEN 'reject'
                    ELSE LOWER("status"::text)
                END
            )::"public"."party_profiles_status_enum_old"
        `);
        await queryRunner.query(`ALTER TABLE "party_profiles" ALTER COLUMN "status" SET DEFAULT 'pending'`);
        await queryRunner.query(`DROP TYPE "public"."party_profiles_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."party_profiles_status_enum_old" RENAME TO "party_profiles_status_enum"`);
    }

}
