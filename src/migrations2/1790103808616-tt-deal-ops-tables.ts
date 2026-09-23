import { MigrationInterface, QueryRunner } from "typeorm";

export class TtDealOpsTables1790103808616 implements MigrationInterface {
    name = 'TtDealOpsTables1790103808616'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."deal_covers_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')`);
        await queryRunner.query(`CREATE TABLE "deal_covers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "branch_id" uuid NOT NULL, "branch_snapshot" jsonb NOT NULL, "transaction_date" TIMESTAMP WITH TIME ZONE NOT NULL, "bank_account_profile_id" uuid NOT NULL, "bank_account_profile_snapshot" jsonb NOT NULL, "product_id" uuid NOT NULL, "product_snapshot" jsonb NOT NULL, "party_profile_type" citext NOT NULL, "party_profile_id" uuid NOT NULL, "party_profile_snapshot" jsonb NOT NULL, "marketing_executive_id" uuid, "marketing_executive_snapshot" jsonb, "passenger_id" uuid, "passenger_name" citext, "passenger_pan" citext, "passenger_pan_holder" citext, "passenger_pan_dob" date, "passenger_passport" citext, "purpose_id" uuid NOT NULL, "purpose_snapshot" jsonb NOT NULL, "subpurpose_id" uuid, "subpurpose_snapshot" jsonb, "currency_id" uuid NOT NULL, "currency_snapshot" jsonb NOT NULL, "issuer_party_profile_id" uuid NOT NULL, "issuer_party_profile_snapshot" jsonb NOT NULL, "fe_amount" numeric(18,2) NOT NULL, "deal_rate" numeric(18,7) NOT NULL, "deal_rate_snapshot" jsonb NOT NULL, "inr_amount" numeric(18,2) NOT NULL, "fb_charge_amount" numeric(18,2) NOT NULL DEFAULT '0', "narration" text, "maturity_option_id" uuid NOT NULL, "status" "public"."deal_covers_status_enum" NOT NULL DEFAULT 'PENDING', "deal_no" citext, "booking_rate" numeric(18,7), "rejection_reason" text, "cancelled_at" TIMESTAMP WITH TIME ZONE, "cancelled_by_id" uuid, "consumed_transaction_item_id" uuid, "consumed_transaction_id" uuid, "approved_at" TIMESTAMP WITH TIME ZONE, "approved_by_id" uuid, "rejected_at" TIMESTAMP WITH TIME ZONE, "rejected_by_id" uuid, CONSTRAINT "PK_3fd5e5a8ddc6f12b029ab38320b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_deal_covers_consumed_item" ON "deal_covers" ("consumed_transaction_item_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_deal_covers_deal_no" ON "deal_covers" ("deal_no") `);
        await queryRunner.query(`CREATE INDEX "IDX_deal_covers_issuer" ON "deal_covers" ("issuer_party_profile_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_deal_covers_product" ON "deal_covers" ("product_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_deal_covers_currency" ON "deal_covers" ("currency_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_deal_covers_transaction_date" ON "deal_covers" ("transaction_date") `);
        await queryRunner.query(`CREATE INDEX "IDX_deal_covers_branch" ON "deal_covers" ("branch_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_deal_covers_status" ON "deal_covers" ("status") `);
        await queryRunner.query(`CREATE TABLE "tt_settlement_documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "transaction_number" citext NOT NULL, "transaction_date" TIMESTAMP WITH TIME ZONE NOT NULL, "kind" citext NOT NULL, "status" citext NOT NULL, "issuer_party_profile_id" uuid NOT NULL, "issuer_party_profile_snapshot" jsonb NOT NULL, "currency_id" uuid NOT NULL, "currency_snapshot" jsonb NOT NULL, "branch_id" uuid NOT NULL, "branch_snapshot" jsonb NOT NULL, "ho_branch_id" uuid NOT NULL, "ho_branch_snapshot" jsonb NOT NULL, "reference" citext, "remarks" text, "rejection_reason" text, "cancellation_reason" text, "accepted_at" TIMESTAMP WITH TIME ZONE, "accepted_by_id" uuid, "rejected_at" TIMESTAMP WITH TIME ZONE, "rejected_by_id" uuid, "cancelled_at" TIMESTAMP WITH TIME ZONE, "cancelled_by_id" uuid, "posting_transaction_id" uuid, CONSTRAINT "PK_6ad7eb3f6df9bf35ad8cd0b02b6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_tt_settlement_documents_branch" ON "tt_settlement_documents" ("branch_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_tt_settlement_documents_issuer" ON "tt_settlement_documents" ("issuer_party_profile_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_tt_settlement_documents_date" ON "tt_settlement_documents" ("transaction_date") `);
        await queryRunner.query(`CREATE INDEX "IDX_tt_settlement_documents_kind" ON "tt_settlement_documents" ("kind") `);
        await queryRunner.query(`CREATE INDEX "IDX_tt_settlement_documents_status" ON "tt_settlement_documents" ("status") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_tt_settlement_documents_number" ON "tt_settlement_documents" ("transaction_number") `);
        await queryRunner.query(`CREATE TYPE "public"."tt_settlements_settlement_mode_enum" AS ENUM('AUTO', 'MANUAL')`);
        await queryRunner.query(`CREATE TYPE "public"."tt_settlements_status_enum" AS ENUM('UNSETTLED', 'PENDING_HO_ACCEPTANCE', 'BRANCH_HO_ACCEPTED', 'HO_ISSUER_PENDING', 'SETTLED', 'CANCELLED')`);
        await queryRunner.query(`CREATE TABLE "tt_settlements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "deal_cover_id" uuid NOT NULL, "transaction_id" uuid NOT NULL, "transaction_item_id" uuid NOT NULL, "branch_id" uuid NOT NULL, "branch_snapshot" jsonb NOT NULL, "ho_branch_id" uuid NOT NULL, "ho_branch_snapshot" jsonb NOT NULL, "issuer_party_profile_id" uuid NOT NULL, "issuer_party_profile_snapshot" jsonb NOT NULL, "currency_id" uuid NOT NULL, "currency_snapshot" jsonb NOT NULL, "product_id" uuid NOT NULL, "product_snapshot" jsonb NOT NULL, "passenger_id" uuid, "passenger_snapshot" jsonb, "fe_amount" numeric(18,2) NOT NULL, "deal_rate" numeric(18,7) NOT NULL, "booking_rate" numeric(18,7), "customer_rate" numeric(18,7), "settlement_amount" numeric(18,2) NOT NULL, "issuer_rate" numeric(18,7), "issuer_settlement_amount" numeric(18,2), "profit_amount" numeric(18,2), "branch_document_id" uuid, "issuer_document_id" uuid, "sale_date" TIMESTAMP WITH TIME ZONE NOT NULL, "settlement_mode" "public"."tt_settlements_settlement_mode_enum" NOT NULL, "branch_requested_date" TIMESTAMP WITH TIME ZONE, "branch_reference" citext, "branch_remarks" text, "branch_requested_at" TIMESTAMP WITH TIME ZONE, "branch_requested_by_id" uuid, "ho_accepted_at" TIMESTAMP WITH TIME ZONE, "ho_accepted_by_id" uuid, "ho_rejected_at" TIMESTAMP WITH TIME ZONE, "ho_rejected_by_id" uuid, "ho_rejection_reason" text, "branch_settlement_date" TIMESTAMP WITH TIME ZONE, "issuer_settlement_date" TIMESTAMP WITH TIME ZONE, "issuer_reference" citext, "issuer_remarks" text, "status" "public"."tt_settlements_status_enum" NOT NULL, "cancelled_at" TIMESTAMP WITH TIME ZONE, "cancelled_by_id" uuid, "cancellation_reason" text, CONSTRAINT "PK_53a15bbf9a9ebe97c2095009ab3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_tt_settlements_issuer_document" ON "tt_settlements" ("issuer_document_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_tt_settlements_branch_document" ON "tt_settlements" ("branch_document_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_tt_settlements_deal_item" ON "tt_settlements" ("deal_cover_id", "transaction_item_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_tt_settlements_sale_date" ON "tt_settlements" ("sale_date") `);
        await queryRunner.query(`CREATE INDEX "IDX_tt_settlements_issuer" ON "tt_settlements" ("issuer_party_profile_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_tt_settlements_branch" ON "tt_settlements" ("branch_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_tt_settlements_status" ON "tt_settlements" ("status") `);
        await queryRunner.query(`CREATE TABLE "tt_remittance_details" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "transaction_id" uuid NOT NULL, "remitter_name" citext NOT NULL, "remitter_address" text, "remitter_city" citext, "remitter_country_id" uuid, "remitter_country_snapshot" jsonb, "remitter_entity_type" citext, "beneficiary_name" citext NOT NULL, "beneficiary_address" text, "beneficiary_country_id" uuid, "beneficiary_country_snapshot" jsonb, "bank_name" citext NOT NULL, "bank_address" text, "account_number" citext, "iban" citext, "swift_code" citext, "bsb_code" citext, "sort_code" citext, "routing_number" citext, "transit_number" citext, "education_details" text, "fb_bearer_option_id" uuid, "fb_bearer_option_snapshot" jsonb, "intermediary_bank_name" citext, "intermediary_bank_address" text, "intermediary_bank_codes" citext, "relationship" text, "sponsorship_name" citext, "sponsorship_pan" citext, "date_of_incorporation" date, "mice_amount" numeric(18,2), "mice_reference" text, CONSTRAINT "PK_969454552b2937a3fe006944543" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_tt_remittance_details_transaction" ON "tt_remittance_details" ("transaction_id") `);
        await queryRunner.query(`ALTER TABLE "transaction_items" ADD "deal_cover_id" uuid`);
        await queryRunner.query(`ALTER TABLE "transaction_items" ADD "deal_cover_snapshot" jsonb`);
        await queryRunner.query(`ALTER TABLE "transaction_items" ADD "tt_remittance_detail_id" uuid`);
        await queryRunner.query(`ALTER TYPE "public"."manual_books_transaction_type_enum" RENAME TO "manual_books_transaction_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."manual_books_transaction_type_enum" AS ENUM('FAKE_CURRENCY', 'DEAL_COVER', 'TT_SETTLE', 'PURCHASE_FFMC', 'PURCHASE_CORPORATE_INDIVIDUAL', 'SALE_CORPORATE_INDIVIDUAL', 'SALE_FFMC', 'SALE_RMC', 'SALE_FOREX', 'SALE_FOREIGN', 'SALE_MISC', 'SALE_FRANCHISE', 'PURCHASE_RMC', 'PURCHASE_FOREX', 'PURCHASE_FOREIGN', 'PURCHASE_MISC', 'PURCHASE_FRANCHISE')`);
        await queryRunner.query(`ALTER TABLE "manual_books" ALTER COLUMN "transaction_type" TYPE "public"."manual_books_transaction_type_enum" USING "transaction_type"::"text"::"public"."manual_books_transaction_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."manual_books_transaction_type_enum_old"`);
        await queryRunner.query(`ALTER TABLE "tt_settlement_documents" ADD CONSTRAINT "FK_tt_settlement_documents_posting" FOREIGN KEY ("posting_transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tt_settlements" ADD CONSTRAINT "FK_tt_settlements_deal_cover" FOREIGN KEY ("deal_cover_id") REFERENCES "deal_covers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tt_settlements" ADD CONSTRAINT "FK_tt_settlements_transaction" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tt_settlements" ADD CONSTRAINT "FK_tt_settlements_transaction_item" FOREIGN KEY ("transaction_item_id") REFERENCES "transaction_items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tt_settlements" ADD CONSTRAINT "FK_tt_settlements_branch_document" FOREIGN KEY ("branch_document_id") REFERENCES "tt_settlement_documents"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tt_settlements" ADD CONSTRAINT "FK_tt_settlements_issuer_document" FOREIGN KEY ("issuer_document_id") REFERENCES "tt_settlement_documents"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tt_remittance_details" ADD CONSTRAINT "FK_tt_remittance_details_transaction" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tt_remittance_details" DROP CONSTRAINT "FK_tt_remittance_details_transaction"`);
        await queryRunner.query(`ALTER TABLE "tt_settlements" DROP CONSTRAINT "FK_tt_settlements_issuer_document"`);
        await queryRunner.query(`ALTER TABLE "tt_settlements" DROP CONSTRAINT "FK_tt_settlements_branch_document"`);
        await queryRunner.query(`ALTER TABLE "tt_settlements" DROP CONSTRAINT "FK_tt_settlements_transaction_item"`);
        await queryRunner.query(`ALTER TABLE "tt_settlements" DROP CONSTRAINT "FK_tt_settlements_transaction"`);
        await queryRunner.query(`ALTER TABLE "tt_settlements" DROP CONSTRAINT "FK_tt_settlements_deal_cover"`);
        await queryRunner.query(`ALTER TABLE "tt_settlement_documents" DROP CONSTRAINT "FK_tt_settlement_documents_posting"`);
        await queryRunner.query(`CREATE TYPE "public"."manual_books_transaction_type_enum_old" AS ENUM('FAKE_CURRENCY', 'PURCHASE_FFMC', 'PURCHASE_CORPORATE_INDIVIDUAL', 'SALE_CORPORATE_INDIVIDUAL', 'SALE_FFMC', 'SALE_RMC', 'SALE_FOREX', 'SALE_FOREIGN', 'SALE_MISC', 'SALE_FRANCHISE', 'PURCHASE_RMC', 'PURCHASE_FOREX', 'PURCHASE_FOREIGN', 'PURCHASE_MISC', 'PURCHASE_FRANCHISE')`);
        await queryRunner.query(`ALTER TABLE "manual_books" ALTER COLUMN "transaction_type" TYPE "public"."manual_books_transaction_type_enum_old" USING "transaction_type"::"text"::"public"."manual_books_transaction_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."manual_books_transaction_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."manual_books_transaction_type_enum_old" RENAME TO "manual_books_transaction_type_enum"`);
        await queryRunner.query(`ALTER TABLE "transaction_items" DROP COLUMN "tt_remittance_detail_id"`);
        await queryRunner.query(`ALTER TABLE "transaction_items" DROP COLUMN "deal_cover_snapshot"`);
        await queryRunner.query(`ALTER TABLE "transaction_items" DROP COLUMN "deal_cover_id"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_tt_remittance_details_transaction"`);
        await queryRunner.query(`DROP TABLE "tt_remittance_details"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tt_settlements_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tt_settlements_branch"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tt_settlements_issuer"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tt_settlements_sale_date"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_tt_settlements_deal_item"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tt_settlements_branch_document"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tt_settlements_issuer_document"`);
        await queryRunner.query(`DROP TABLE "tt_settlements"`);
        await queryRunner.query(`DROP TYPE "public"."tt_settlements_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."tt_settlements_settlement_mode_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tt_settlement_documents_number"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tt_settlement_documents_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tt_settlement_documents_kind"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tt_settlement_documents_date"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tt_settlement_documents_issuer"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tt_settlement_documents_branch"`);
        await queryRunner.query(`DROP TABLE "tt_settlement_documents"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_deal_covers_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_deal_covers_branch"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_deal_covers_transaction_date"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_deal_covers_currency"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_deal_covers_product"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_deal_covers_issuer"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_deal_covers_deal_no"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_deal_covers_consumed_item"`);
        await queryRunner.query(`DROP TABLE "deal_covers"`);
        await queryRunner.query(`DROP TYPE "public"."deal_covers_status_enum"`);
    }

}
