import { MigrationInterface, QueryRunner } from "typeorm";

export class DayEndWorker1789527285400 implements MigrationInterface {
    name = 'DayEndWorker1789527285400'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."day_end_events_status_enum" AS ENUM('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED')`);
        await queryRunner.query(`CREATE TABLE "day_end_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "day_end_execution_id" uuid NOT NULL, "branch_id" uuid NOT NULL, "business_date" date NOT NULL, "event_type" citext NOT NULL, "payload" jsonb NOT NULL, "status" "public"."day_end_events_status_enum" NOT NULL DEFAULT 'PENDING', "attempt_count" integer NOT NULL DEFAULT '0', "available_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "processed_at" TIMESTAMP WITH TIME ZONE, "error_message" text, "locked_at" TIMESTAMP WITH TIME ZONE, "locked_by_id" uuid, CONSTRAINT "PK_c4a2bec890502fd74866eaaa4bf" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_day_end_events_branch_business_date_event_type" ON "day_end_events" ("branch_id", "business_date", "event_type") `);
        await queryRunner.query(`CREATE INDEX "IDX_day_end_events_status_available_at" ON "day_end_events" ("status", "available_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_day_end_events_day_end_execution_id" ON "day_end_events" ("day_end_execution_id") `);
        await queryRunner.query(`ALTER TABLE "day_end_events" ADD CONSTRAINT "FK_day_end_events_day_end_execution_id" FOREIGN KEY ("day_end_execution_id") REFERENCES "day_end_executions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "day_end_events" DROP CONSTRAINT "FK_day_end_events_day_end_execution_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_day_end_events_day_end_execution_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_day_end_events_status_available_at"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_day_end_events_branch_business_date_event_type"`);
        await queryRunner.query(`DROP TABLE "day_end_events"`);
        await queryRunner.query(`DROP TYPE "public"."day_end_events_status_enum"`);
    }

}
