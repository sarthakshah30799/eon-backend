import { MigrationInterface, QueryRunner } from "typeorm";

export class Ad1ChangeSnapshot1784154529695 implements MigrationInterface {
    name = 'Ad1ChangeSnapshot1784154529695'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction_ad1" DROP COLUMN "fx_ref_agent_id"`);
        await queryRunner.query(`ALTER TABLE "transaction_ad1" DROP COLUMN "comm_given_id"`);
        await queryRunner.query(`ALTER TABLE "transaction_ad1" DROP COLUMN "comm_percent_on_fe"`);
        await queryRunner.query(`ALTER TABLE "transaction_ad1" ADD "agent_id" uuid`);
        await queryRunner.query(`ALTER TABLE "transaction_ad1" ADD "branch_snapshot" jsonb`);
        await queryRunner.query(`ALTER TABLE "transaction_ad1" ADD "currency_snapshot" jsonb`);
        await queryRunner.query(`ALTER TABLE "transaction_ad1" ADD "product_snapshot" jsonb`);
        await queryRunner.query(`ALTER TABLE "transaction_ad1" ADD "agent_snapshot" jsonb`);
        await queryRunner.query(`ALTER TABLE "transaction_ad1" ADD "bank_snapshot" jsonb`);
        await queryRunner.query(`ALTER TABLE "transaction_ad1" ADD "marketing_snapshot" jsonb`);
        await queryRunner.query(`ALTER TABLE "transaction_ad1" ADD "segment_snapshot" jsonb`);
        await queryRunner.query(`ALTER TABLE "transaction_ad1" ADD "purpose_snapshot" jsonb`);
        await queryRunner.query(`ALTER TABLE "transaction_ad1" ADD "relationship_snapshot" jsonb`);
        await queryRunner.query(`ALTER TYPE "public"."manual_books_status_enum" RENAME TO "manual_books_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."manual_books_status_enum" AS ENUM('PENDING', 'APPROVE', 'REJECT')`);
        await queryRunner.query(`ALTER TABLE "manual_books" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "manual_books" ALTER COLUMN "status" TYPE "public"."manual_books_status_enum" USING "status"::"text"::"public"."manual_books_status_enum"`);
        await queryRunner.query(`ALTER TABLE "manual_books" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."manual_books_status_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."cheque_books_status_enum" RENAME TO "cheque_books_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."cheque_books_status_enum" AS ENUM('PENDING', 'APPROVE', 'REJECT')`);
        await queryRunner.query(`ALTER TABLE "cheque_books" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "cheque_books" ALTER COLUMN "status" TYPE "public"."cheque_books_status_enum" USING "status"::"text"::"public"."cheque_books_status_enum"`);
        await queryRunner.query(`ALTER TABLE "cheque_books" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."cheque_books_status_enum_old"`);
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
        await queryRunner.query(`ALTER TYPE "public"."transactions_transaction_type_enum" RENAME TO "transactions_transaction_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_transaction_type_enum" AS ENUM('SALE', 'PURCHASE')`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "transaction_type" TYPE "public"."transactions_transaction_type_enum" USING "transaction_type"::"text"::"public"."transactions_transaction_type_enum"`);
        await queryRunner.query(`ALTER TABLE "transaction_ad1" ALTER COLUMN "transaction_type" TYPE "public"."transactions_transaction_type_enum" USING "transaction_type"::"text"::"public"."transactions_transaction_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_transaction_type_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."transactions_trade_mode_enum" RENAME TO "transactions_trade_mode_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_trade_mode_enum" AS ENUM('BULK', 'RETAIL')`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "trade_mode" TYPE "public"."transactions_trade_mode_enum" USING "trade_mode"::"text"::"public"."transactions_trade_mode_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_trade_mode_enum_old"`);
        // transactions_status_enum already has DRAFT/PENDING/APPROVED/REJECTED — no change needed
        await queryRunner.query(`CREATE INDEX "IDX_transaction_events_status_available_at" ON "transaction_events" ("status", "available_at") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_transaction_events_status_available_at"`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_status_enum_old" AS ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED')`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "status" TYPE "public"."transactions_status_enum_old" USING "status"::"text"::"public"."transactions_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "status" SET DEFAULT 'DRAFT'`);
        await queryRunner.query(`DROP TYPE "public"."transactions_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."transactions_status_enum_old" RENAME TO "transactions_status_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_trade_mode_enum_old" AS ENUM('BULK', 'RETAIL')`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "trade_mode" TYPE "public"."transactions_trade_mode_enum_old" USING "trade_mode"::"text"::"public"."transactions_trade_mode_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_trade_mode_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."transactions_trade_mode_enum_old" RENAME TO "transactions_trade_mode_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_transaction_type_enum_old" AS ENUM('SALE', 'PURCHASE')`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "transaction_type" TYPE "public"."transactions_transaction_type_enum_old" USING "transaction_type"::"text"::"public"."transactions_transaction_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_transaction_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."transactions_transaction_type_enum_old" RENAME TO "transactions_transaction_type_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."transaction_events_status_enum_old" AS ENUM('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED')`);
        await queryRunner.query(`ALTER TABLE "transaction_events" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "transaction_events" ALTER COLUMN "status" TYPE "public"."transaction_events_status_enum_old" USING "status"::"text"::"public"."transaction_events_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "transaction_events" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."transaction_events_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."transaction_events_status_enum_old" RENAME TO "transaction_events_status_enum"`);
        await queryRunner.query(`CREATE INDEX "IDX_transaction_events_status_available_at" ON "transaction_events" ("available_at", "status") `);
        await queryRunner.query(`CREATE TYPE "public"."transaction_logs_action_enum_old" AS ENUM('CREATE', 'UPDATE', 'SUBMIT', 'APPROVE', 'REJECT', 'VERSION_CREATE', 'DOCUMENT_UPDATE', 'ADDITIONAL_CHARGE_UPDATE', 'PAYMENT_UPDATE', 'PRINT')`);
        await queryRunner.query(`ALTER TABLE "transaction_logs" ALTER COLUMN "action" TYPE "public"."transaction_logs_action_enum_old" USING "action"::"text"::"public"."transaction_logs_action_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."transaction_logs_action_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."transaction_logs_action_enum_old" RENAME TO "transaction_logs_action_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."transaction_documents_status_enum_old" AS ENUM('PENDING', 'ATTACHED', 'REMOVED')`);
        await queryRunner.query(`ALTER TABLE "transaction_documents" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "transaction_documents" ALTER COLUMN "status" TYPE "public"."transaction_documents_status_enum_old" USING "status"::"text"::"public"."transaction_documents_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "transaction_documents" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."transaction_documents_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."transaction_documents_status_enum_old" RENAME TO "transaction_documents_status_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."cheque_books_status_enum_old" AS ENUM('PENDING', 'APPROVE', 'REJECT')`);
        await queryRunner.query(`ALTER TABLE "cheque_books" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "cheque_books" ALTER COLUMN "status" TYPE "public"."cheque_books_status_enum_old" USING "status"::"text"::"public"."cheque_books_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "cheque_books" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."cheque_books_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."cheque_books_status_enum_old" RENAME TO "cheque_books_status_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."manual_books_status_enum_old" AS ENUM('PENDING', 'APPROVE', 'REJECT')`);
        await queryRunner.query(`ALTER TABLE "manual_books" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "manual_books" ALTER COLUMN "status" TYPE "public"."manual_books_status_enum_old" USING "status"::"text"::"public"."manual_books_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "manual_books" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."manual_books_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."manual_books_status_enum_old" RENAME TO "manual_books_status_enum"`);
        await queryRunner.query(`ALTER TABLE "transaction_ad1" DROP COLUMN "relationship_snapshot"`);
        await queryRunner.query(`ALTER TABLE "transaction_ad1" DROP COLUMN "purpose_snapshot"`);
        await queryRunner.query(`ALTER TABLE "transaction_ad1" DROP COLUMN "segment_snapshot"`);
        await queryRunner.query(`ALTER TABLE "transaction_ad1" DROP COLUMN "marketing_snapshot"`);
        await queryRunner.query(`ALTER TABLE "transaction_ad1" DROP COLUMN "bank_snapshot"`);
        await queryRunner.query(`ALTER TABLE "transaction_ad1" DROP COLUMN "agent_snapshot"`);
        await queryRunner.query(`ALTER TABLE "transaction_ad1" DROP COLUMN "product_snapshot"`);
        await queryRunner.query(`ALTER TABLE "transaction_ad1" DROP COLUMN "currency_snapshot"`);
        await queryRunner.query(`ALTER TABLE "transaction_ad1" DROP COLUMN "branch_snapshot"`);
        await queryRunner.query(`ALTER TABLE "transaction_ad1" DROP COLUMN "agent_id"`);
        await queryRunner.query(`ALTER TABLE "transaction_ad1" ADD "comm_percent_on_fe" numeric(18,4)`);
        await queryRunner.query(`ALTER TABLE "transaction_ad1" ADD "comm_given_id" uuid`);
        await queryRunner.query(`ALTER TABLE "transaction_ad1" ADD "fx_ref_agent_id" uuid`);
    }

}
