import { MigrationInterface, QueryRunner } from "typeorm";

export class DynamicReportGeneration1790171038369 implements MigrationInterface {
    name = 'DynamicReportGeneration1790171038369'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "special_reports" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "report_type" citext NOT NULL, "report_name" citext NOT NULL, "report_query" text NOT NULL, "active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_6246f99aea1b0218b2a3cfc2530" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_special_reports_report_type" ON "special_reports" ("report_type") WHERE "deleted_at" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."UQ_special_reports_report_type"`);
        await queryRunner.query(`DROP TABLE "special_reports"`);
    }

}
