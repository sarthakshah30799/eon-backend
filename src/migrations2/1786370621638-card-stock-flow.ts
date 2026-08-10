import { MigrationInterface, QueryRunner } from "typeorm";

export class CardStockFlow1786370621638 implements MigrationInterface {
    name = 'CardStockFlow1786370621638'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."card_stock_receipts_status_enum" AS ENUM('POSTED')`);
        await queryRunner.query(`CREATE TABLE "card_stock_receipts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "transaction_number" citext NOT NULL, "receipt_date" date NOT NULL, "ho_branch_id" uuid NOT NULL, "ho_branch_snapshot" jsonb NOT NULL, "issuer_party_profile_id" uuid NOT NULL, "issuer_party_profile_snapshot" jsonb NOT NULL, "status" "public"."card_stock_receipts_status_enum" NOT NULL DEFAULT 'POSTED', "total_fe_amount" numeric(18,2) NOT NULL, CONSTRAINT "PK_41befcb55256236c8d8d1442f11" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_card_stock_receipts_date" ON "card_stock_receipts" ("receipt_date") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_card_stock_receipts_transaction_number" ON "card_stock_receipts" ("transaction_number") `);
        await queryRunner.query(`CREATE TABLE "card_stock_receipt_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "receipt_id" uuid NOT NULL, "line_no" integer NOT NULL, "currency_id" uuid NOT NULL, "currency_snapshot" jsonb NOT NULL, "per" numeric(18,7) NOT NULL, "product_id" uuid NOT NULL, "product_snapshot" jsonb NOT NULL, "issuer_party_profile_id" uuid NOT NULL, "issuer_party_profile_snapshot" jsonb NOT NULL, "fe_amount" numeric(18,2) NOT NULL, CONSTRAINT "PK_e781355b6ba958ed4dee31581d8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_card_stock_receipt_items_issuer" ON "card_stock_receipt_items" ("issuer_party_profile_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_card_stock_receipt_items_product" ON "card_stock_receipt_items" ("product_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_card_stock_receipt_items_currency" ON "card_stock_receipt_items" ("currency_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_card_stock_receipt_items_receipt_line" ON "card_stock_receipt_items" ("receipt_id", "line_no") `);
        await queryRunner.query(`CREATE TYPE "public"."card_stock_cards_status_enum" AS ENUM('AVAILABLE', 'RESERVED')`);
        await queryRunner.query(`CREATE TABLE "card_stock_cards" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "receipt_item_id" uuid NOT NULL, "series" citext NOT NULL, "quantity" integer NOT NULL DEFAULT '1', "kit_number" citext NOT NULL, "card_number" bytea NOT NULL, "denomination" numeric(18,2) NOT NULL, "amount" numeric(18,2) NOT NULL, "expiration_date" date NOT NULL, "current_branch_id" uuid NOT NULL, "current_branch_snapshot" jsonb NOT NULL, "status" "public"."card_stock_cards_status_enum" NOT NULL DEFAULT 'AVAILABLE', "reserved_by_transfer_id" uuid, "reserved_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_1601ceae368722b80f592c62ebe" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_card_stock_cards_reserved_transfer" ON "card_stock_cards" ("reserved_by_transfer_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_card_stock_cards_kit_number" ON "card_stock_cards" ("kit_number") `);
        await queryRunner.query(`CREATE INDEX "IDX_card_stock_cards_branch_status" ON "card_stock_cards" ("current_branch_id", "status") `);
        await queryRunner.query(`CREATE INDEX "IDX_card_stock_cards_receipt_item" ON "card_stock_cards" ("receipt_item_id") `);
        await queryRunner.query(`CREATE TABLE "card_transfer_request_cards" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "transfer_item_id" uuid NOT NULL, "card_id" uuid NOT NULL, CONSTRAINT "PK_e199d264d8bc2989ab0ca015754" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_card_transfer_request_cards_card" ON "card_transfer_request_cards" ("card_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_card_transfer_request_cards_item_card" ON "card_transfer_request_cards" ("transfer_item_id", "card_id") `);
        await queryRunner.query(`CREATE TABLE "card_transfer_request_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "transfer_id" uuid NOT NULL, "line_no" integer NOT NULL, "currency_id" uuid NOT NULL, "currency_snapshot" jsonb NOT NULL, "per" numeric(18,7) NOT NULL, "product_id" uuid NOT NULL, "product_snapshot" jsonb NOT NULL, "issuer_party_profile_id" uuid NOT NULL, "issuer_party_profile_snapshot" jsonb NOT NULL, "fe_amount" numeric(18,2) NOT NULL, CONSTRAINT "PK_a21bb269e69552144536005326e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_card_transfer_request_items_transfer_line" ON "card_transfer_request_items" ("transfer_id", "line_no") `);
        await queryRunner.query(`CREATE TYPE "public"."card_transfer_requests_status_enum" AS ENUM('HELD', 'ACCEPTED', 'REJECTED', 'CANCELLED')`);
        await queryRunner.query(`CREATE TABLE "card_transfer_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "transaction_number" citext NOT NULL, "transaction_date" date NOT NULL, "source_branch_id" uuid NOT NULL, "source_branch_snapshot" jsonb NOT NULL, "destination_branch_id" uuid NOT NULL, "destination_branch_snapshot" jsonb NOT NULL, "status" "public"."card_transfer_requests_status_enum" NOT NULL DEFAULT 'HELD', "total_fe_amount" numeric(18,2) NOT NULL, "remarks" text, "held_at" TIMESTAMP WITH TIME ZONE, "accepted_at" TIMESTAMP WITH TIME ZONE, "rejected_at" TIMESTAMP WITH TIME ZONE, "held_by_id" uuid, "accepted_by_id" uuid, "rejected_by_id" uuid, CONSTRAINT "PK_f39db3867f64d8a3f86bbb76e17" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_card_transfer_requests_destination_branch" ON "card_transfer_requests" ("destination_branch_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_card_transfer_requests_source_branch" ON "card_transfer_requests" ("source_branch_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_card_transfer_requests_status" ON "card_transfer_requests" ("status") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_card_transfer_requests_transaction_number" ON "card_transfer_requests" ("transaction_number") `);
        await queryRunner.query(`ALTER TABLE "card_stock_receipt_items" ADD CONSTRAINT "FK_card_stock_receipt_items_receipt" FOREIGN KEY ("receipt_id") REFERENCES "card_stock_receipts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "card_stock_cards" ADD CONSTRAINT "FK_card_stock_cards_receipt_item" FOREIGN KEY ("receipt_item_id") REFERENCES "card_stock_receipt_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "card_transfer_request_cards" ADD CONSTRAINT "FK_card_transfer_request_cards_item" FOREIGN KEY ("transfer_item_id") REFERENCES "card_transfer_request_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "card_transfer_request_cards" ADD CONSTRAINT "FK_card_transfer_request_cards_card" FOREIGN KEY ("card_id") REFERENCES "card_stock_cards"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "card_transfer_request_items" ADD CONSTRAINT "FK_card_transfer_request_items_transfer" FOREIGN KEY ("transfer_id") REFERENCES "card_transfer_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "card_transfer_request_items" DROP CONSTRAINT "FK_card_transfer_request_items_transfer"`);
        await queryRunner.query(`ALTER TABLE "card_transfer_request_cards" DROP CONSTRAINT "FK_card_transfer_request_cards_card"`);
        await queryRunner.query(`ALTER TABLE "card_transfer_request_cards" DROP CONSTRAINT "FK_card_transfer_request_cards_item"`);
        await queryRunner.query(`ALTER TABLE "card_stock_cards" DROP CONSTRAINT "FK_card_stock_cards_receipt_item"`);
        await queryRunner.query(`ALTER TABLE "card_stock_receipt_items" DROP CONSTRAINT "FK_card_stock_receipt_items_receipt"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_card_transfer_requests_transaction_number"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_card_transfer_requests_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_card_transfer_requests_source_branch"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_card_transfer_requests_destination_branch"`);
        await queryRunner.query(`DROP TABLE "card_transfer_requests"`);
        await queryRunner.query(`DROP TYPE "public"."card_transfer_requests_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_card_transfer_request_items_transfer_line"`);
        await queryRunner.query(`DROP TABLE "card_transfer_request_items"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_card_transfer_request_cards_item_card"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_card_transfer_request_cards_card"`);
        await queryRunner.query(`DROP TABLE "card_transfer_request_cards"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_card_stock_cards_receipt_item"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_card_stock_cards_branch_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_card_stock_cards_kit_number"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_card_stock_cards_reserved_transfer"`);
        await queryRunner.query(`DROP TABLE "card_stock_cards"`);
        await queryRunner.query(`DROP TYPE "public"."card_stock_cards_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_card_stock_receipt_items_receipt_line"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_card_stock_receipt_items_currency"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_card_stock_receipt_items_product"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_card_stock_receipt_items_issuer"`);
        await queryRunner.query(`DROP TABLE "card_stock_receipt_items"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_card_stock_receipts_transaction_number"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_card_stock_receipts_date"`);
        await queryRunner.query(`DROP TABLE "card_stock_receipts"`);
        await queryRunner.query(`DROP TYPE "public"."card_stock_receipts_status_enum"`);
    }

}
