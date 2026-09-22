import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCreditRequestFund1790019478245 implements MigrationInterface {
    name = 'AddCreditRequestFund1790019478245'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."credit_request_fund_items_direction_enum" AS ENUM('DEBIT', 'CREDIT')`);
        await queryRunner.query(`CREATE TABLE "credit_request_fund_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "credit_request_fund_id" uuid NOT NULL, "line_no" integer NOT NULL, "item_type_option_id" uuid NOT NULL, "item_type_snapshot" jsonb NOT NULL, "subledger_party_profile_id" uuid, "subledger_party_profile_snapshot" jsonb, "subledger_branch_id" uuid, "subledger_branch_snapshot" jsonb, "account_id" uuid NOT NULL, "account_snapshot" jsonb NOT NULL, "direction" "public"."credit_request_fund_items_direction_enum" NOT NULL, "amount" numeric(18,2) NOT NULL, CONSTRAINT "CHK_credit_request_fund_items_amount_positive" CHECK ("amount" > 0), CONSTRAINT "PK_ba500626c8ca8a83fd72010ae4f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_credit_request_fund_items_line" ON "credit_request_fund_items" ("credit_request_fund_id", "line_no") `);
        await queryRunner.query(`CREATE TYPE "public"."credit_request_funds_status_enum" AS ENUM('PENDING', 'APPROVE', 'REJECT', 'CANCELLED')`);
        await queryRunner.query(`CREATE TYPE "public"."credit_request_funds_account_mode_enum" AS ENUM('CASH', 'BANK_CHEQUE', 'PETTY_CASH', 'CREDIT_CARD')`);
        await queryRunner.query(`CREATE TYPE "public"."credit_request_funds_payment_method_enum" AS ENUM('CASH', 'CHEQUE', 'BANK_TRANSFER', 'UPI', 'NEFT', 'RTGS', 'IMPS', 'CARD', 'OTHER')`);
        await queryRunner.query(`CREATE TABLE "credit_request_funds" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "number" citext NOT NULL, "number_series_code" text NOT NULL, "idempotency_key" text NOT NULL, "payload_hash" text NOT NULL, "status" "public"."credit_request_funds_status_enum" NOT NULL DEFAULT 'PENDING', "transaction_date" date NOT NULL, "branch_id" uuid NOT NULL, "branch_snapshot" jsonb NOT NULL, "counter_id" uuid NOT NULL, "counter_snapshot" jsonb NOT NULL, "destination_branch_id" uuid NOT NULL, "destination_branch_snapshot" jsonb NOT NULL, "account_type_option_id" uuid NOT NULL, "account_type_snapshot" jsonb NOT NULL, "account_mode" "public"."credit_request_funds_account_mode_enum" NOT NULL, "header_account_id" uuid NOT NULL, "header_account_snapshot" jsonb NOT NULL, "entity_type_option_id" uuid NOT NULL, "entity_type_snapshot" jsonb NOT NULL, "party_profile_id" uuid NOT NULL, "party_profile_snapshot" jsonb NOT NULL, "payment_method" "public"."credit_request_funds_payment_method_enum", "cheque_number" citext, "normalized_cheque_number" citext, "cheque_date" date, "cheque_branch" text, "drawn_on" text, "remark_option_id" uuid, "remark_snapshot" jsonb, "narration" text NOT NULL, "paid_by_pan_number" citext, "paid_by_pan_name" citext, "paid_by_pan_dob" date, "pan_holder_relation_option_id" uuid, "pan_holder_relation_snapshot" jsonb, "traveler_pan_number" citext, "traveler_pan_name" citext, "traveler_pan_dob" date, "total_debit" numeric(18,2) NOT NULL, "total_credit" numeric(18,2) NOT NULL, "final_amount" numeric(18,2) NOT NULL, "approved_by" uuid, "approved_at" TIMESTAMP WITH TIME ZONE, "approved_transaction_date" date, "rejected_by" uuid, "rejected_at" TIMESTAMP WITH TIME ZONE, "rejection_remarks" text, "cancelled_by" uuid, "cancelled_at" TIMESTAMP WITH TIME ZONE, "destination_receipt_voucher_id" uuid, "destination_receipt_voucher_snapshot" jsonb, "requesting_receipt_voucher_id" uuid, "requesting_receipt_voucher_snapshot" jsonb, "requesting_payment_voucher_id" uuid, "requesting_payment_voucher_snapshot" jsonb, CONSTRAINT "CHK_credit_request_funds_amounts_nonnegative" CHECK ("total_debit" >= 0 AND "total_credit" >= 0 AND "final_amount" >= 0), CONSTRAINT "PK_b8d7ab187c28446d2bf0f34d15b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_credit_request_funds_party" ON "credit_request_funds" ("party_profile_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_credit_request_funds_destination_branch" ON "credit_request_funds" ("destination_branch_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_credit_request_funds_branch" ON "credit_request_funds" ("branch_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_credit_request_funds_status_date" ON "credit_request_funds" ("status", "transaction_date") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_credit_request_funds_idempotency" ON "credit_request_funds" ("idempotency_key") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_credit_request_funds_number" ON "credit_request_funds" ("number") `);
        await queryRunner.query(`ALTER TABLE "accounting_voucher_items" ADD "subledger_branch_id" uuid`);
        await queryRunner.query(`ALTER TABLE "accounting_voucher_items" ADD "subledger_branch_snapshot" jsonb`);
        await queryRunner.query(`ALTER TABLE "credit_request_fund_items" ADD CONSTRAINT "FK_credit_request_fund_items_header" FOREIGN KEY ("credit_request_fund_id") REFERENCES "credit_request_funds"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "credit_request_fund_items" DROP CONSTRAINT "FK_credit_request_fund_items_header"`);
        await queryRunner.query(`ALTER TABLE "accounting_voucher_items" DROP COLUMN "subledger_branch_snapshot"`);
        await queryRunner.query(`ALTER TABLE "accounting_voucher_items" DROP COLUMN "subledger_branch_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_credit_request_funds_number"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_credit_request_funds_idempotency"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_credit_request_funds_status_date"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_credit_request_funds_branch"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_credit_request_funds_destination_branch"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_credit_request_funds_party"`);
        await queryRunner.query(`DROP TABLE "credit_request_funds"`);
        await queryRunner.query(`DROP TYPE "public"."credit_request_funds_payment_method_enum"`);
        await queryRunner.query(`DROP TYPE "public"."credit_request_funds_account_mode_enum"`);
        await queryRunner.query(`DROP TYPE "public"."credit_request_funds_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_credit_request_fund_items_line"`);
        await queryRunner.query(`DROP TABLE "credit_request_fund_items"`);
        await queryRunner.query(`DROP TYPE "public"."credit_request_fund_items_direction_enum"`);
    }

}
