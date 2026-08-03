import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTransferFlow1785584787551 implements MigrationInterface {
    name = 'AddTransferFlow1785584787551'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction_passenger_other_documents" DROP CONSTRAINT "CHK_transaction_passenger_other_documents_document_number_prese"`);
        await queryRunner.query(`CREATE TABLE "transfer_request_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "transfer_id" uuid NOT NULL, "line_no" integer NOT NULL, "currency_id" uuid NOT NULL, "currency_snapshot" jsonb, "product_id" uuid NOT NULL, "product_snapshot" jsonb, "quantity" numeric(18,7) NOT NULL, "per" numeric(18,7) NOT NULL, "rate" numeric(18,7) NOT NULL, "rate_editable" boolean NOT NULL DEFAULT false, "amount" numeric(18,2) NOT NULL, "round_off" numeric(18,2) NOT NULL DEFAULT '0', "final_amount" numeric(18,2) NOT NULL, "remarks" text, CONSTRAINT "PK_e20cbd105903459003ab52b2a7e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_transfer_request_items_transfer_line" ON "transfer_request_items" ("transfer_id", "line_no") `);
        await queryRunner.query(`CREATE INDEX "IDX_transfer_request_items_transfer_id" ON "transfer_request_items" ("transfer_id") `);
        await queryRunner.query(`CREATE TYPE "public"."transfer_requests_transfer_type_enum" AS ENUM('COUNTER', 'BRANCH')`);
        await queryRunner.query(`CREATE TYPE "public"."transfer_requests_status_enum" AS ENUM('HELD', 'ACCEPTED', 'REJECTED', 'CANCELLED')`);
        await queryRunner.query(`CREATE TABLE "transfer_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "number" citext, "transfer_type" "public"."transfer_requests_transfer_type_enum" NOT NULL, "status" "public"."transfer_requests_status_enum" NOT NULL DEFAULT 'HELD', "transaction_date" TIMESTAMP WITH TIME ZONE, "bill_reference" citext, "source_branch_id" uuid NOT NULL, "source_branch_snapshot" jsonb, "source_counter_id" uuid NOT NULL, "source_counter_snapshot" jsonb, "destination_branch_id" uuid NOT NULL, "destination_branch_snapshot" jsonb, "destination_counter_id" uuid NOT NULL, "destination_counter_snapshot" jsonb, "source_transaction_id" uuid, "destination_transaction_id" uuid, "source_number_series_code" citext, "destination_number_series_code" citext, "remarks" text, "held_at" TIMESTAMP WITH TIME ZONE, "accepted_at" TIMESTAMP WITH TIME ZONE, "rejected_at" TIMESTAMP WITH TIME ZONE, "cancelled_at" TIMESTAMP WITH TIME ZONE, "held_by_id" uuid, "accepted_by_id" uuid, "rejected_by_id" uuid, "cancelled_by_id" uuid, CONSTRAINT "PK_f97530bf47e4af43166089627ba" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_transfer_requests_destination_transaction_id" ON "transfer_requests" ("destination_transaction_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_transfer_requests_source_transaction_id" ON "transfer_requests" ("source_transaction_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_transfer_requests_destination_counter" ON "transfer_requests" ("destination_counter_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_transfer_requests_destination_branch" ON "transfer_requests" ("destination_branch_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_transfer_requests_source_counter" ON "transfer_requests" ("source_counter_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_transfer_requests_source_branch" ON "transfer_requests" ("source_branch_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_transfer_requests_type" ON "transfer_requests" ("transfer_type") `);
        await queryRunner.query(`CREATE INDEX "IDX_transfer_requests_status" ON "transfer_requests" ("status") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_transfer_requests_number" ON "transfer_requests" ("number") `);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "transfer_request_id" uuid`);
        await queryRunner.query(`ALTER TYPE "public"."transactions_transaction_party_profile_type_enum" RENAME TO "transactions_transaction_party_profile_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_transaction_party_profile_type_enum" AS ENUM('FFMC', 'CORPORATE', 'INDIVIDUAL', 'RMC', 'FRANCHISE', 'FOREX', 'MISC', 'BRANCH', 'COUNTER')`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "transaction_party_profile_type" TYPE "public"."transactions_transaction_party_profile_type_enum" USING "transaction_party_profile_type"::"text"::"public"."transactions_transaction_party_profile_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_transaction_party_profile_type_enum_old"`);
        await queryRunner.query(`CREATE INDEX "IDX_transactions_transfer_request_id" ON "transactions" ("transfer_request_id") `);
        await queryRunner.query(`ALTER TABLE "transaction_passenger_other_documents" ADD CONSTRAINT "CHK_transaction_passenger_other_documents_document_number_present" CHECK ("document_number" IS NOT NULL)`);
        await queryRunner.query(`ALTER TABLE "transfer_request_items" ADD CONSTRAINT "FK_transfer_request_items_transfer_id" FOREIGN KEY ("transfer_id") REFERENCES "transfer_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transfer_requests" ADD CONSTRAINT "FK_transfer_requests_source_transaction_id" FOREIGN KEY ("source_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transfer_requests" ADD CONSTRAINT "FK_transfer_requests_destination_transaction_id" FOREIGN KEY ("destination_transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_transactions_transfer_request_id" FOREIGN KEY ("transfer_request_id") REFERENCES "transfer_requests"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_transactions_transfer_request_id"`);
        await queryRunner.query(`ALTER TABLE "transfer_requests" DROP CONSTRAINT "FK_transfer_requests_destination_transaction_id"`);
        await queryRunner.query(`ALTER TABLE "transfer_requests" DROP CONSTRAINT "FK_transfer_requests_source_transaction_id"`);
        await queryRunner.query(`ALTER TABLE "transfer_request_items" DROP CONSTRAINT "FK_transfer_request_items_transfer_id"`);
        await queryRunner.query(`ALTER TABLE "transaction_passenger_other_documents" DROP CONSTRAINT "CHK_transaction_passenger_other_documents_document_number_present"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transactions_transfer_request_id"`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_transaction_party_profile_type_enum_old" AS ENUM('CORPORATE', 'FFMC', 'FOREX', 'FRANCHISE', 'INDIVIDUAL', 'MISC', 'RMC')`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "transaction_party_profile_type" TYPE "public"."transactions_transaction_party_profile_type_enum_old" USING "transaction_party_profile_type"::"text"::"public"."transactions_transaction_party_profile_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_transaction_party_profile_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."transactions_transaction_party_profile_type_enum_old" RENAME TO "transactions_transaction_party_profile_type_enum"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "transfer_request_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transfer_requests_number"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transfer_requests_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transfer_requests_type"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transfer_requests_source_branch"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transfer_requests_source_counter"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transfer_requests_destination_branch"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transfer_requests_destination_counter"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transfer_requests_source_transaction_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transfer_requests_destination_transaction_id"`);
        await queryRunner.query(`DROP TABLE "transfer_requests"`);
        await queryRunner.query(`DROP TYPE "public"."transfer_requests_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transfer_requests_transfer_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transfer_request_items_transfer_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transfer_request_items_transfer_line"`);
        await queryRunner.query(`DROP TABLE "transfer_request_items"`);
        await queryRunner.query(`ALTER TABLE "transaction_passenger_other_documents" ADD CONSTRAINT "CHK_transaction_passenger_other_documents_document_number_prese" CHECK ((document_number IS NOT NULL))`);
    }

}
