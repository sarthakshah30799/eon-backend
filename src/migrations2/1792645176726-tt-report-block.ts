import { MigrationInterface, QueryRunner } from "typeorm";

export class TtReportBlock1792645176726 implements MigrationInterface {
    name = 'TtReportBlock1792645176726'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transactions" ADD "tt_report_blocked" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "tt_report_blocked_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TYPE "public"."deal_covers_status_enum" RENAME TO "deal_covers_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."deal_covers_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" TYPE "public"."deal_covers_status_enum" USING "status"::"text"::"public"."deal_covers_status_enum"`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."deal_covers_status_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."deal_covers_status_enum_old" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" TYPE "public"."deal_covers_status_enum_old" USING "status"::"text"::"public"."deal_covers_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."deal_covers_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."deal_covers_status_enum_old" RENAME TO "deal_covers_status_enum"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "tt_report_blocked_at"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "tt_report_blocked"`);
    }

}
