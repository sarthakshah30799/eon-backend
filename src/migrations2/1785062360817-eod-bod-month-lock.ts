import { MigrationInterface, QueryRunner } from "typeorm";

export class EodBodMonthLock1785062360817 implements MigrationInterface {
    name = 'EodBodMonthLock1785062360817'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction_passenger_other_documents" DROP CONSTRAINT "CHK_transaction_passenger_other_documents_document_number_prese"`);
        await queryRunner.query(`CREATE TABLE "monthly_lock_windows" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "branch_id" uuid NOT NULL, "user_id" uuid NOT NULL, "from_date" date NOT NULL, "to_date" date NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "revoked_at" TIMESTAMP WITH TIME ZONE, "revoked_by" uuid, CONSTRAINT "PK_83abbf8962876d49ba6ad2cea8c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_monthly_lock_windows_branch_user" ON "monthly_lock_windows" ("branch_id", "user_id") `);
        await queryRunner.query(`CREATE TYPE "public"."day_end_executions_status_enum" AS ENUM('OPEN', 'BOD_COMPLETED', 'EOD_COMPLETED')`);
        await queryRunner.query(`CREATE TABLE "day_end_executions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "branch_id" uuid NOT NULL, "user_id" uuid NOT NULL, "business_date" date NOT NULL, "bod_at" TIMESTAMP WITH TIME ZONE, "eod_at" TIMESTAMP WITH TIME ZONE, "status" "public"."day_end_executions_status_enum" NOT NULL DEFAULT 'OPEN', "checklist_snapshot" jsonb, CONSTRAINT "PK_8156e8627afd3ad3ed338dba1b2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_day_end_executions_branch_user_business_date" ON "day_end_executions" ("branch_id", "user_id", "business_date") `);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "transaction_date" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`CREATE INDEX "IDX_transactions_transaction_date" ON "transactions" ("transaction_date") `);
        await queryRunner.query(`ALTER TABLE "transaction_passenger_other_documents" ADD CONSTRAINT "CHK_transaction_passenger_other_documents_document_number_present" CHECK ("document_number" IS NOT NULL)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction_passenger_other_documents" DROP CONSTRAINT "CHK_transaction_passenger_other_documents_document_number_present"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transactions_transaction_date"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "transaction_date"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_day_end_executions_branch_user_business_date"`);
        await queryRunner.query(`DROP TABLE "day_end_executions"`);
        await queryRunner.query(`DROP TYPE "public"."day_end_executions_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_monthly_lock_windows_branch_user"`);
        await queryRunner.query(`DROP TABLE "monthly_lock_windows"`);
        await queryRunner.query(`ALTER TABLE "transaction_passenger_other_documents" ADD CONSTRAINT "CHK_transaction_passenger_other_documents_document_number_prese" CHECK ((document_number IS NOT NULL))`);
    }

}
