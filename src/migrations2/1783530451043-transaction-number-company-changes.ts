import { MigrationInterface, QueryRunner } from "typeorm";

export class TransactionNumberCompanyChanges1783530451043 implements MigrationInterface {
    name = 'TransactionNumberCompanyChanges1783530451043'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transactions" ADD "company_id" uuid`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "company_snapshot" jsonb`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "sac_code" citext`);
        await queryRunner.query(`ALTER TYPE "public"."transaction_documents_status_enum" RENAME TO "transaction_documents_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."transaction_documents_status_enum" AS ENUM('PENDING', 'ATTACHED', 'REMOVED')`);
        await queryRunner.query(`ALTER TABLE "transaction_documents" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "transaction_documents" ALTER COLUMN "status" TYPE "public"."transaction_documents_status_enum" USING "status"::"text"::"public"."transaction_documents_status_enum"`);
        await queryRunner.query(`ALTER TABLE "transaction_documents" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."transaction_documents_status_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."transaction_logs_action_enum" RENAME TO "transaction_logs_action_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."transaction_logs_action_enum" AS ENUM('CREATE', 'UPDATE', 'SUBMIT', 'APPROVE', 'REJECT', 'VERSION_CREATE', 'DOCUMENT_UPDATE', 'ADDITIONAL_CHARGE_UPDATE', 'PAYMENT_UPDATE', 'PRINT')`);
        await queryRunner.query(`ALTER TABLE "transaction_logs" ALTER COLUMN "action" TYPE "public"."transaction_logs_action_enum" USING "action"::"text"::"public"."transaction_logs_action_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transaction_logs_action_enum_old"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transaction_events_status_available_at"`);
        await queryRunner.query(`ALTER TYPE "public"."transaction_events_status_enum" RENAME TO "transaction_events_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."transaction_events_status_enum" AS ENUM('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED')`);
        await queryRunner.query(`ALTER TABLE "transaction_events" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "transaction_events" ALTER COLUMN "status" TYPE "public"."transaction_events_status_enum" USING "status"::"text"::"public"."transaction_events_status_enum"`);
        await queryRunner.query(`ALTER TABLE "transaction_events" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."transaction_events_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "number" DROP NOT NULL`);
        await queryRunner.query(`ALTER TYPE "public"."transactions_transaction_type_enum" RENAME TO "transactions_transaction_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_transaction_type_enum" AS ENUM('SALE', 'PURCHASE')`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "transaction_type" TYPE "public"."transactions_transaction_type_enum" USING "transaction_type"::"text"::"public"."transactions_transaction_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_transaction_type_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."transactions_trade_mode_enum" RENAME TO "transactions_trade_mode_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_trade_mode_enum" AS ENUM('BULK', 'RETAIL')`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "trade_mode" TYPE "public"."transactions_trade_mode_enum" USING "trade_mode"::"text"::"public"."transactions_trade_mode_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_trade_mode_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."transactions_status_enum" RENAME TO "transactions_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_status_enum" AS ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED')`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "status" TYPE "public"."transactions_status_enum" USING "status"::"text"::"public"."transactions_status_enum"`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "status" SET DEFAULT 'DRAFT'`);
        await queryRunner.query(`DROP TYPE "public"."transactions_status_enum_old"`);
        await queryRunner.query(`CREATE INDEX "IDX_transaction_events_status_available_at" ON "transaction_events" ("status", "available_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_transactions_company_id" ON "transactions" ("company_id") `);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "CHK_transactions_number_required_when_approved" CHECK ("status" <> 'APPROVED' OR "number" IS NOT NULL)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "CHK_transactions_number_required_when_approved"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transactions_company_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transaction_events_status_available_at"`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_status_enum_old" AS ENUM('APPROVED', 'DRAFT', 'PENDING', 'REJECTED')`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "status" TYPE "public"."transactions_status_enum_old" USING "status"::"text"::"public"."transactions_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "status" SET DEFAULT 'DRAFT'`);
        await queryRunner.query(`DROP TYPE "public"."transactions_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."transactions_status_enum_old" RENAME TO "transactions_status_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_trade_mode_enum_old" AS ENUM('BULK', 'RETAIL')`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "trade_mode" TYPE "public"."transactions_trade_mode_enum_old" USING "trade_mode"::"text"::"public"."transactions_trade_mode_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_trade_mode_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."transactions_trade_mode_enum_old" RENAME TO "transactions_trade_mode_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_transaction_type_enum_old" AS ENUM('PURCHASE', 'SALE')`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "transaction_type" TYPE "public"."transactions_transaction_type_enum_old" USING "transaction_type"::"text"::"public"."transactions_transaction_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_transaction_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."transactions_transaction_type_enum_old" RENAME TO "transactions_transaction_type_enum"`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "number" SET NOT NULL`);
        await queryRunner.query(`CREATE TYPE "public"."transaction_events_status_enum_old" AS ENUM('FAILED', 'PENDING', 'PROCESSED', 'PROCESSING')`);
        await queryRunner.query(`ALTER TABLE "transaction_events" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "transaction_events" ALTER COLUMN "status" TYPE "public"."transaction_events_status_enum_old" USING "status"::"text"::"public"."transaction_events_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "transaction_events" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."transaction_events_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."transaction_events_status_enum_old" RENAME TO "transaction_events_status_enum"`);
        await queryRunner.query(`CREATE INDEX "IDX_transaction_events_status_available_at" ON "transaction_events" ("available_at", "status") `);
        await queryRunner.query(`CREATE TYPE "public"."transaction_logs_action_enum_old" AS ENUM('ADDITIONAL_CHARGE_UPDATE', 'APPROVE', 'CREATE', 'DOCUMENT_UPDATE', 'PAYMENT_UPDATE', 'PRINT', 'REJECT', 'SUBMIT', 'UPDATE', 'VERSION_CREATE')`);
        await queryRunner.query(`ALTER TABLE "transaction_logs" ALTER COLUMN "action" TYPE "public"."transaction_logs_action_enum_old" USING "action"::"text"::"public"."transaction_logs_action_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."transaction_logs_action_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."transaction_logs_action_enum_old" RENAME TO "transaction_logs_action_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."transaction_documents_status_enum_old" AS ENUM('ATTACHED', 'PENDING', 'REMOVED')`);
        await queryRunner.query(`ALTER TABLE "transaction_documents" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "transaction_documents" ALTER COLUMN "status" TYPE "public"."transaction_documents_status_enum_old" USING "status"::"text"::"public"."transaction_documents_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "transaction_documents" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."transaction_documents_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."transaction_documents_status_enum_old" RENAME TO "transaction_documents_status_enum"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "sac_code"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "company_snapshot"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "company_id"`);
    }

}
