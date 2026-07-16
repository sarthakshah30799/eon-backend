import { MigrationInterface, QueryRunner } from "typeorm";

export class Ad1TransactionInit1784095899088 implements MigrationInterface {
    name = 'Ad1TransactionInit1784095899088'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."transaction_ad1_profile_type_enum" AS ENUM('AD1')`);
        await queryRunner.query(`CREATE TABLE "transaction_ad1" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "number" character varying(100) NOT NULL, "branch_id" uuid NOT NULL, "company_id" uuid, "transaction_type" "public"."transactions_transaction_type_enum" NOT NULL, "profile_type" "public"."transaction_ad1_profile_type_enum", "deal_id" citext, "doc_no" citext, "transaction_date" date, "marketing_id" uuid, "segment_id" uuid, "serviced_by" citext, "purpose_id" uuid, "remitter_name" citext, "contact_no" citext, "email" citext, "address" citext, "pan" citext, "date_of_birth" date, "product_id" uuid, "beneficiary_name" citext, "beni_address" citext, "bene_account_number" citext, "bene_bank_name" citext, "swift_code" citext, "relationship_id" uuid, "currency_id" uuid, "fc_volume" numeric(18,7), "sale_rate" numeric(18,7), "total_inr_amt" numeric(18,2), "gst" numeric(18,2), "bank_charges" numeric(18,2), "tcs" numeric(18,2), "other_income" numeric(18,2), "final_amount" numeric(18,2), "settlement_rate" numeric(18,2), "gross_revenue" numeric(18,2), "revenue_receivable" numeric(18,2), "fx_ref_agent_id" uuid, "comm_given_id" uuid, "comm_percent_on_fe" numeric(18,4), "agent_comm" numeric(18,2), "tds" numeric(18,2), "commission_payable" numeric(18,2), "net_revenue" numeric(18,2), "bank_name_id" uuid, "rtgs_imps_neft_ref_no" citext, "remarks" text, CONSTRAINT "PK_3b0abab1e6fc48df5084eb0ed13" PRIMARY KEY ("id"))`);
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
        await queryRunner.query(`ALTER TYPE "public"."transactions_status_enum" RENAME TO "transactions_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_status_enum" AS ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED')`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "status" TYPE "public"."transactions_status_enum" USING "status"::"text"::"public"."transactions_status_enum"`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "status" SET DEFAULT 'DRAFT'`);
        await queryRunner.query(`DROP TYPE "public"."transactions_status_enum_old"`);
        await queryRunner.query(`CREATE INDEX "IDX_transaction_events_status_available_at" ON "transaction_events" ("status", "available_at") `);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "CHK_transactions_number_required_when_approved" CHECK ("status" <> 'APPROVED' OR "number" IS NOT NULL)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "CHK_transactions_number_required_when_approved"`);
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
        await queryRunner.query(`ALTER TABLE "transaction_ad1" ALTER COLUMN "transaction_type" TYPE "public"."transactions_transaction_type_enum_old" USING "transaction_type"::"text"::"public"."transactions_transaction_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_transaction_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."transactions_transaction_type_enum_old" RENAME TO "transactions_transaction_type_enum"`);
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
        await queryRunner.query(`CREATE TYPE "public"."cheque_books_status_enum_old" AS ENUM('APPROVE', 'PENDING', 'REJECT')`);
        await queryRunner.query(`ALTER TABLE "cheque_books" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "cheque_books" ALTER COLUMN "status" TYPE "public"."cheque_books_status_enum_old" USING "status"::"text"::"public"."cheque_books_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "cheque_books" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."cheque_books_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."cheque_books_status_enum_old" RENAME TO "cheque_books_status_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."manual_books_status_enum_old" AS ENUM('APPROVE', 'PENDING', 'REJECT')`);
        await queryRunner.query(`ALTER TABLE "manual_books" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "manual_books" ALTER COLUMN "status" TYPE "public"."manual_books_status_enum_old" USING "status"::"text"::"public"."manual_books_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "manual_books" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."manual_books_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."manual_books_status_enum_old" RENAME TO "manual_books_status_enum"`);
        await queryRunner.query(`DROP TABLE "transaction_ad1"`);
        await queryRunner.query(`DROP TYPE "public"."transaction_ad1_profile_type_enum"`);
    }

}
