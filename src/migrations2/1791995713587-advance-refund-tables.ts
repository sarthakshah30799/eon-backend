import { MigrationInterface, QueryRunner } from "typeorm";

export class AdvanceRefundTables1791995713587 implements MigrationInterface {
    name = 'AdvanceRefundTables1791995713587'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "product_settlements" DROP CONSTRAINT "CHK_product_settlements_type_refs"`);
        await queryRunner.query(`CREATE TABLE "advance_refund_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "advance_refund_id" uuid NOT NULL, "line_no" integer NOT NULL, "receipt_voucher_id" uuid NOT NULL, "receipt_voucher_snapshot" jsonb NOT NULL, "original_receipt_amount" numeric(18,2) NOT NULL, "consumed_amount" numeric(18,2) NOT NULL, "available_amount" numeric(18,2) NOT NULL, "refund_amount" numeric(18,2) NOT NULL, CONSTRAINT "CHK_advance_refund_item_amount_positive" CHECK ("refund_amount" > 0), CONSTRAINT "PK_c0ba7157136346ad1685cb3ba5c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_advance_refund_items_receipt_voucher_id" ON "advance_refund_items" ("receipt_voucher_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_advance_refund_items_header_id" ON "advance_refund_items" ("advance_refund_id") `);
        await queryRunner.query(`CREATE TYPE "public"."advance_refund_refund_type_enum" AS ENUM('REFUND', 'KNOCK_OFF')`);
        await queryRunner.query(`CREATE TYPE "public"."advance_refund_status_enum" AS ENUM('DRAFT', 'PENDING_HO_APPROVAL', 'COMPLETED', 'CANCELLED')`);
        await queryRunner.query(`CREATE TYPE "public"."advance_refund_payout_source_enum" AS ENUM('LOCAL_BANK', 'HO_PAYOUT')`);
        await queryRunner.query(`CREATE TABLE "advance_refund" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "number" citext NOT NULL, "branch_id" uuid NOT NULL, "branch_snapshot" jsonb NOT NULL, "counter_id" uuid NOT NULL, "counter_snapshot" jsonb NOT NULL, "transaction_date" date NOT NULL, "as_on_date" date NOT NULL, "party_profile_id" uuid NOT NULL, "party_profile_snapshot" jsonb NOT NULL, "pan_number" citext, "pan_name" citext, "pan_dob" date, "refund_type" "public"."advance_refund_refund_type_enum" NOT NULL, "status" "public"."advance_refund_status_enum" NOT NULL DEFAULT 'DRAFT', "total_refund_amount" numeric(18,2) NOT NULL, "narration" text NOT NULL, "remark_option_id" uuid, "remark_snapshot" jsonb, "knock_off_account_id" uuid, "knock_off_account_snapshot" jsonb, "payout_source" "public"."advance_refund_payout_source_enum", "paying_bank_account_id" uuid, "paying_bank_account_snapshot" jsonb, "payment_method" citext, "beneficiary_account_number" citext, "beneficiary_ifsc_code" citext, "beneficiary_name" citext, "bank_name" citext, "cheque_number" citext, "cheque_date" date, "drawn_on" citext, "journal_voucher_id" uuid, "payment_voucher_id" uuid, "advice_voucher_id" uuid, "ho_payment_voucher_id" uuid, CONSTRAINT "PK_0ee66695eda39c9f4c7424d25a1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_advance_refund_status" ON "advance_refund" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_advance_refund_party" ON "advance_refund" ("party_profile_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_advance_refund_branch_date" ON "advance_refund" ("branch_id", "transaction_date") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_advance_refund_number" ON "advance_refund" ("number") `);
        await queryRunner.query(`ALTER TYPE "public"."manual_books_transaction_type_enum" RENAME TO "manual_books_transaction_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."manual_books_transaction_type_enum" AS ENUM('FAKE_CURRENCY', 'PURCHASE_FFMC', 'PURCHASE_CORPORATE_INDIVIDUAL', 'SALE_CORPORATE_INDIVIDUAL', 'SALE_FFMC', 'SALE_RMC', 'SALE_FOREX', 'SALE_FOREIGN', 'SALE_MISC', 'SALE_FRANCHISE', 'PURCHASE_RMC', 'PURCHASE_FOREX', 'PURCHASE_FOREIGN', 'PURCHASE_MISC', 'PURCHASE_FRANCHISE')`);
        await queryRunner.query(`ALTER TABLE "manual_books" ALTER COLUMN "transaction_type" TYPE "public"."manual_books_transaction_type_enum" USING "transaction_type"::"text"::"public"."manual_books_transaction_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."manual_books_transaction_type_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."purpose_rate_type_enum" RENAME TO "purpose_rate_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."transaction_tcs_breakdowns_rate_type_enum" AS ENUM('PERCENT', 'RUPEES')`);
        await queryRunner.query(`ALTER TABLE "transaction_tcs_breakdowns" ALTER COLUMN "rate_type" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "transaction_tcs_breakdowns" ALTER COLUMN "rate_type" TYPE "public"."transaction_tcs_breakdowns_rate_type_enum" USING "rate_type"::"text"::"public"."transaction_tcs_breakdowns_rate_type_enum"`);
        await queryRunner.query(`ALTER TABLE "transaction_tcs_breakdowns" ALTER COLUMN "rate_type" SET DEFAULT 'PERCENT'`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_tcs_rate_type_enum" AS ENUM('PERCENT', 'RUPEES')`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "tcs_rate_type" TYPE "public"."transactions_tcs_rate_type_enum" USING "tcs_rate_type"::"text"::"public"."transactions_tcs_rate_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."purpose_rate_type_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."deal_covers_status_enum" RENAME TO "deal_covers_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."deal_covers_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" TYPE "public"."deal_covers_status_enum" USING "status"::"text"::"public"."deal_covers_status_enum"`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."deal_covers_status_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."card_stock_settlements_settlement_mode_enum" RENAME TO "card_stock_settlements_settlement_mode_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."product_settlements_settlement_mode_enum" AS ENUM('AUTO', 'MANUAL')`);
        await queryRunner.query(`ALTER TABLE "product_settlements" ALTER COLUMN "settlement_mode" TYPE "public"."product_settlements_settlement_mode_enum" USING "settlement_mode"::"text"::"public"."product_settlements_settlement_mode_enum"`);
        await queryRunner.query(`DROP TYPE "public"."card_stock_settlements_settlement_mode_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."card_stock_settlements_status_enum" RENAME TO "card_stock_settlements_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."product_settlements_status_enum" AS ENUM('PENDING_BRANCH_SETTLEMENT', 'PENDING_HO_ACCEPTANCE', 'PENDING_ISSUER_SETTLEMENT', 'ISSUER_SETTLED', 'CANCELLED')`);
        await queryRunner.query(`ALTER TABLE "product_settlements" ALTER COLUMN "status" TYPE "public"."product_settlements_status_enum" USING "status"::"text"::"public"."product_settlements_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."card_stock_settlements_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "advance_refund_items" ADD CONSTRAINT "FK_advance_refund_items_header" FOREIGN KEY ("advance_refund_id") REFERENCES "advance_refund"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "advance_refund_items" DROP CONSTRAINT "FK_advance_refund_items_header"`);
        await queryRunner.query(`CREATE TYPE "public"."card_stock_settlements_status_enum_old" AS ENUM('CANCELLED', 'ISSUER_SETTLED', 'PENDING_BRANCH_SETTLEMENT', 'PENDING_HO_ACCEPTANCE', 'PENDING_ISSUER_SETTLEMENT')`);
        await queryRunner.query(`ALTER TABLE "product_settlements" ALTER COLUMN "status" TYPE "public"."card_stock_settlements_status_enum_old" USING "status"::"text"::"public"."card_stock_settlements_status_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."product_settlements_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."card_stock_settlements_status_enum_old" RENAME TO "card_stock_settlements_status_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."card_stock_settlements_settlement_mode_enum_old" AS ENUM('AUTO', 'MANUAL')`);
        await queryRunner.query(`ALTER TABLE "product_settlements" ALTER COLUMN "settlement_mode" TYPE "public"."card_stock_settlements_settlement_mode_enum_old" USING "settlement_mode"::"text"::"public"."card_stock_settlements_settlement_mode_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."product_settlements_settlement_mode_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."card_stock_settlements_settlement_mode_enum_old" RENAME TO "card_stock_settlements_settlement_mode_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."deal_covers_status_enum_old" AS ENUM('APPROVED', 'CANCELLED', 'PENDING', 'REJECTED')`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" TYPE "public"."deal_covers_status_enum_old" USING "status"::"text"::"public"."deal_covers_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."deal_covers_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."deal_covers_status_enum_old" RENAME TO "deal_covers_status_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."purpose_rate_type_enum" AS ENUM('PERCENT', 'RUPEES')`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "tcs_rate_type" TYPE "public"."purpose_rate_type_enum" USING "tcs_rate_type"::"text"::"public"."purpose_rate_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_tcs_rate_type_enum"`);
        await queryRunner.query(`ALTER TABLE "transaction_tcs_breakdowns" ALTER COLUMN "rate_type" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "transaction_tcs_breakdowns" ALTER COLUMN "rate_type" TYPE "public"."purpose_rate_type_enum" USING "rate_type"::"text"::"public"."purpose_rate_type_enum"`);
        await queryRunner.query(`ALTER TABLE "transaction_tcs_breakdowns" ALTER COLUMN "rate_type" SET DEFAULT 'PERCENT'`);
        await queryRunner.query(`DROP TYPE "public"."transaction_tcs_breakdowns_rate_type_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."manual_books_transaction_type_enum_old" AS ENUM('DEAL_COVER', 'FAKE_CURRENCY', 'PURCHASE_CORPORATE_INDIVIDUAL', 'PURCHASE_FFMC', 'PURCHASE_FOREIGN', 'PURCHASE_FOREX', 'PURCHASE_FRANCHISE', 'PURCHASE_MISC', 'PURCHASE_RMC', 'SALE_CORPORATE_INDIVIDUAL', 'SALE_FFMC', 'SALE_FOREIGN', 'SALE_FOREX', 'SALE_FRANCHISE', 'SALE_MISC', 'SALE_RMC')`);
        await queryRunner.query(`ALTER TABLE "manual_books" ALTER COLUMN "transaction_type" TYPE "public"."manual_books_transaction_type_enum_old" USING "transaction_type"::"text"::"public"."manual_books_transaction_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."manual_books_transaction_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."manual_books_transaction_type_enum_old" RENAME TO "manual_books_transaction_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_advance_refund_number"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_advance_refund_branch_date"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_advance_refund_party"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_advance_refund_status"`);
        await queryRunner.query(`DROP TABLE "advance_refund"`);
        await queryRunner.query(`DROP TYPE "public"."advance_refund_payout_source_enum"`);
        await queryRunner.query(`DROP TYPE "public"."advance_refund_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."advance_refund_refund_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_advance_refund_items_header_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_advance_refund_items_receipt_voucher_id"`);
        await queryRunner.query(`DROP TABLE "advance_refund_items"`);
        await queryRunner.query(`ALTER TABLE "product_settlements" ADD CONSTRAINT "CHK_product_settlements_type_refs" CHECK ((((type = 'CARD'::citext) AND (card_id IS NOT NULL) AND (deal_cover_id IS NULL)) OR ((type = 'TT'::citext) AND (deal_cover_id IS NOT NULL) AND (card_id IS NULL))))`);
    }

}
