import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTransactionFlow1783263858596 implements MigrationInterface {
    name = 'AddTransactionFlow1783263858596'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "transaction_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "transaction_id" uuid NOT NULL, "line_no" integer NOT NULL, "currency_id" uuid NOT NULL, "product_id" uuid NOT NULL, "currency_rate_id" uuid, "product_currency_rate_id" uuid, "quantity" numeric(18,4) NOT NULL, "rate" numeric(18,4) NOT NULL, "currency_snapshot" jsonb, "product_snapshot" jsonb, "currency_rate_snapshot" jsonb, "product_currency_rate_snapshot" jsonb, "pricing_rule_snapshot" jsonb, "remarks" text, CONSTRAINT "PK_ff5a487ad820dccafd53bebf578" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_transaction_items_transaction_line" ON "transaction_items" ("transaction_id", "line_no") `);
        await queryRunner.query(`CREATE INDEX "IDX_transaction_items_transaction_id" ON "transaction_items" ("transaction_id") `);
        await queryRunner.query(`CREATE TYPE "public"."transaction_documents_status_enum" AS ENUM('PENDING', 'ATTACHED', 'REMOVED')`);
        await queryRunner.query(`CREATE TABLE "transaction_documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "transaction_id" uuid NOT NULL, "line_no" integer NOT NULL, "document_profile_id" uuid NOT NULL, "document_profile_snapshot" jsonb, "status" "public"."transaction_documents_status_enum" NOT NULL DEFAULT 'PENDING', "file_name" character varying(255), "original_file_name" character varying(255), "mime_type" character varying(150), "file_size" bigint, "storage_key" text, "storage_path" text, "storage_url" text, "remarks" text, CONSTRAINT "PK_4f19bc5a0be85ccb710dbee7d42" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_transaction_documents_transaction_line" ON "transaction_documents" ("transaction_id", "line_no") `);
        await queryRunner.query(`CREATE INDEX "IDX_transaction_documents_transaction_id" ON "transaction_documents" ("transaction_id") `);
        await queryRunner.query(`CREATE TABLE "transaction_additional_charges" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "transaction_id" uuid NOT NULL, "line_no" integer NOT NULL, "account_id" uuid NOT NULL, "account_snapshot" jsonb, "amount" numeric(18,4) NOT NULL, "gst_rate" numeric(18,4), "gst_amount" numeric(18,4), "remarks" text, CONSTRAINT "PK_bde531551c5c9de16965cf2c675" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_transaction_additional_charges_transaction_line" ON "transaction_additional_charges" ("transaction_id", "line_no") `);
        await queryRunner.query(`CREATE INDEX "IDX_transaction_additional_charges_transaction_id" ON "transaction_additional_charges" ("transaction_id") `);
        await queryRunner.query(`CREATE TYPE "public"."transaction_payments_method_enum" AS ENUM('CASH', 'CHEQUE', 'BANK_TRANSFER', 'UPI', 'NEFT', 'RTGS', 'IMPS', 'CARD', 'OTHER')`);
        await queryRunner.query(`CREATE TABLE "transaction_payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "transaction_id" uuid NOT NULL, "line_no" integer NOT NULL, "account_id" uuid NOT NULL, "account_snapshot" jsonb, "cheque_page_id" uuid, "cheque_page_snapshot" jsonb, "payment_method" "public"."transaction_payments_method_enum" NOT NULL DEFAULT 'OTHER', "reference_number" character varying(100), "reference_date" date, "branch_name" character varying(255), "amount" numeric(18,4) NOT NULL, "remarks" text, CONSTRAINT "PK_324e77bea070ff5e6822f478da1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_transaction_payments_transaction_line" ON "transaction_payments" ("transaction_id", "line_no") `);
        await queryRunner.query(`CREATE INDEX "IDX_transaction_payments_transaction_id" ON "transaction_payments" ("transaction_id") `);
        await queryRunner.query(`CREATE TYPE "public"."transaction_logs_action_enum" AS ENUM('CREATE', 'UPDATE', 'SUBMIT', 'APPROVE', 'REJECT', 'VERSION_CREATE', 'DOCUMENT_UPDATE', 'ADDITIONAL_CHARGE_UPDATE', 'PAYMENT_UPDATE', 'PRINT')`);
        await queryRunner.query(`CREATE TABLE "transaction_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "transaction_id" uuid NOT NULL, "action" "public"."transaction_logs_action_enum" NOT NULL, "message" text NOT NULL, "before_snapshot" jsonb, "after_snapshot" jsonb, "metadata" jsonb, "performed_by_id" uuid, "performed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c7605f13413f4b5d06e53f2349b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_transaction_logs_transaction_id" ON "transaction_logs" ("transaction_id") `);
        await queryRunner.query(`CREATE TYPE "public"."transaction_events_status_enum" AS ENUM('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED')`);
        await queryRunner.query(`CREATE TABLE "transaction_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "transaction_id" uuid NOT NULL, "event_type" character varying(150) NOT NULL, "payload" jsonb NOT NULL, "status" "public"."transaction_events_status_enum" NOT NULL DEFAULT 'PENDING', "attempt_count" integer NOT NULL DEFAULT '0', "available_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "processed_at" TIMESTAMP WITH TIME ZONE, "error_message" text, "locked_at" TIMESTAMP WITH TIME ZONE, "locked_by_id" uuid, CONSTRAINT "PK_e0b1cdc84612e5aebf6e6273ff4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_transaction_events_status_available_at" ON "transaction_events" ("status", "available_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_transaction_events_transaction_id" ON "transaction_events" ("transaction_id") `);
        await queryRunner.query(`CREATE TYPE "public"."transactions_transaction_type_enum" AS ENUM('SALE', 'PURCHASE')`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_trade_mode_enum" AS ENUM('BULK', 'RETAIL')`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_status_enum" AS ENUM('DRAFT', 'PENDING', 'APPROVED', 'REJECTED')`);
        await queryRunner.query(`CREATE TABLE "transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "root_transaction_id" uuid, "revision_no" integer NOT NULL DEFAULT '1', "number" character varying(100) NOT NULL, "slug" citext, "branch_id" uuid NOT NULL, "branch_snapshot" jsonb, "party_profile_id" uuid NOT NULL, "party_profile_snapshot" jsonb, "agent_profile_id" uuid, "agent_profile_snapshot" jsonb, "manual_book_page_id" uuid, "manual_book_page_snapshot" jsonb, "transaction_type" "public"."transactions_transaction_type_enum" NOT NULL, "trade_mode" "public"."transactions_trade_mode_enum" NOT NULL, "status" "public"."transactions_status_enum" NOT NULL DEFAULT 'DRAFT', "remarks" text, "submitted_at" TIMESTAMP WITH TIME ZONE, "approved_at" TIMESTAMP WITH TIME ZONE, "rejected_at" TIMESTAMP WITH TIME ZONE, "approved_by_id" uuid, "rejected_by_id" uuid, "approval_remarks" text, "rejection_reason" text, "is_latest" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_transactions_status" ON "transactions" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_transactions_slug" ON "transactions" ("slug") `);
        await queryRunner.query(`CREATE INDEX "IDX_transactions_party_profile_id" ON "transactions" ("party_profile_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_transactions_branch_id" ON "transactions" ("branch_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_transactions_root_transaction_id" ON "transactions" ("root_transaction_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_transactions_number" ON "transactions" ("number") `);
        await queryRunner.query(`ALTER TABLE "transaction_items" ADD CONSTRAINT "FK_transaction_items_transaction_id" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaction_documents" ADD CONSTRAINT "FK_transaction_documents_transaction_id" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaction_additional_charges" ADD CONSTRAINT "FK_transaction_additional_charges_transaction_id" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaction_payments" ADD CONSTRAINT "FK_transaction_payments_transaction_id" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaction_logs" ADD CONSTRAINT "FK_transaction_logs_transaction_id" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaction_events" ADD CONSTRAINT "FK_transaction_events_transaction_id" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_transactions_root_transaction_id" FOREIGN KEY ("root_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_transactions_root_transaction_id"`);
        await queryRunner.query(`ALTER TABLE "transaction_events" DROP CONSTRAINT "FK_transaction_events_transaction_id"`);
        await queryRunner.query(`ALTER TABLE "transaction_logs" DROP CONSTRAINT "FK_transaction_logs_transaction_id"`);
        await queryRunner.query(`ALTER TABLE "transaction_payments" DROP CONSTRAINT "FK_transaction_payments_transaction_id"`);
        await queryRunner.query(`ALTER TABLE "transaction_additional_charges" DROP CONSTRAINT "FK_transaction_additional_charges_transaction_id"`);
        await queryRunner.query(`ALTER TABLE "transaction_documents" DROP CONSTRAINT "FK_transaction_documents_transaction_id"`);
        await queryRunner.query(`ALTER TABLE "transaction_items" DROP CONSTRAINT "FK_transaction_items_transaction_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transactions_number"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transactions_root_transaction_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transactions_branch_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transactions_party_profile_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transactions_slug"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transactions_status"`);
        await queryRunner.query(`DROP TABLE "transactions"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_trade_mode_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_transaction_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transaction_events_transaction_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transaction_events_status_available_at"`);
        await queryRunner.query(`DROP TABLE "transaction_events"`);
        await queryRunner.query(`DROP TYPE "public"."transaction_events_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transaction_logs_transaction_id"`);
        await queryRunner.query(`DROP TABLE "transaction_logs"`);
        await queryRunner.query(`DROP TYPE "public"."transaction_logs_action_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transaction_payments_transaction_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transaction_payments_transaction_line"`);
        await queryRunner.query(`DROP TABLE "transaction_payments"`);
        await queryRunner.query(`DROP TYPE "public"."transaction_payments_method_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transaction_additional_charges_transaction_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transaction_additional_charges_transaction_line"`);
        await queryRunner.query(`DROP TABLE "transaction_additional_charges"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transaction_documents_transaction_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transaction_documents_transaction_line"`);
        await queryRunner.query(`DROP TABLE "transaction_documents"`);
        await queryRunner.query(`DROP TYPE "public"."transaction_documents_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transaction_items_transaction_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transaction_items_transaction_line"`);
        await queryRunner.query(`DROP TABLE "transaction_items"`);
    }

}
