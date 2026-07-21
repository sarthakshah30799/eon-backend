import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTransactionPassengerOtherDocumentEntity1784638727615 implements MigrationInterface {
    name = 'AddTransactionPassengerOtherDocumentEntity1784638727615'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."transaction_passenger_other_documents_document_type_enum" AS ENUM('AADHAAR', 'DRIVING_LICENSE', 'PAN', 'VOTER_ID')`);
        await queryRunner.query(`CREATE TABLE "transaction_passenger_other_documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "transaction_id" uuid NOT NULL, "line_no" integer NOT NULL, "document_type" "public"."transaction_passenger_other_documents_document_type_enum" NOT NULL, "document_number" citext NOT NULL, "valid_till" date, "issue_at" citext, "issue_date" date, "expiry_date" date, "file_name" text, "original_file_name" text, "mime_type" text, "file_size" bigint, "storage_key" text, "storage_path" text, "storage_url" text, "content" bytea, "remarks" text, CONSTRAINT "CHK_transaction_passenger_other_documents_date_order" CHECK ("issue_date" IS NULL OR "expiry_date" IS NULL OR "expiry_date" >= "issue_date"), CONSTRAINT "CHK_transaction_passenger_other_documents_document_number_present" CHECK ("document_number" IS NOT NULL), CONSTRAINT "PK_4052208ce6a77357838a16db67f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_transaction_passenger_other_documents_document_number" ON "transaction_passenger_other_documents" ("document_number") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_transaction_passenger_other_documents_transaction_line_no" ON "transaction_passenger_other_documents" ("transaction_id", "line_no") `);
        await queryRunner.query(`CREATE INDEX "IDX_transaction_passenger_other_documents_transaction_id" ON "transaction_passenger_other_documents" ("transaction_id") `);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "purpose_id" uuid`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "purpose_snapshot" jsonb`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "passenger_id" uuid`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "passenger_snapshot" jsonb`);
        await queryRunner.query(`ALTER TYPE "public"."manual_books_transaction_type_enum" RENAME TO "manual_books_transaction_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."manual_books_transaction_type_enum" AS ENUM('PURCHASE_FFMC', 'PURCHASE_CORPORATE', 'PURCHASE_INDIVIDUAL', 'SALE_FFMC', 'SALE_RMC', 'SALE_FOREX', 'SALE_FOREIGN', 'SALE_MISC', 'SALE_FRANCHISE', 'PURCHASE_RMC', 'PURCHASE_FOREX', 'PURCHASE_FOREIGN', 'PURCHASE_MISC', 'PURCHASE_FRANCHISE')`);
        await queryRunner.query(`ALTER TABLE "manual_books" ALTER COLUMN "transaction_type" TYPE "public"."manual_books_transaction_type_enum" USING "transaction_type"::"text"::"public"."manual_books_transaction_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."manual_books_transaction_type_enum_old"`);
        await queryRunner.query(`CREATE INDEX "IDX_transactions_purpose_id" ON "transactions" ("purpose_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_transactions_passenger_id" ON "transactions" ("passenger_id") `);
        await queryRunner.query(`ALTER TABLE "transaction_passenger_other_documents" ADD CONSTRAINT "FK_transaction_passenger_other_documents_transaction_id" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction_passenger_other_documents" DROP CONSTRAINT "FK_transaction_passenger_other_documents_transaction_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transactions_passenger_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transactions_purpose_id"`);
        await queryRunner.query(`CREATE TYPE "public"."manual_books_transaction_type_enum_old" AS ENUM('PURCHASE_FFMC', 'PURCHASE_FOREIGN', 'PURCHASE_FOREX', 'PURCHASE_FRANCHISE', 'PURCHASE_MISC', 'PURCHASE_RMC', 'SALE_FFMC')`);
        await queryRunner.query(`ALTER TABLE "manual_books" ALTER COLUMN "transaction_type" TYPE "public"."manual_books_transaction_type_enum_old" USING "transaction_type"::"text"::"public"."manual_books_transaction_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."manual_books_transaction_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."manual_books_transaction_type_enum_old" RENAME TO "manual_books_transaction_type_enum"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "passenger_snapshot"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "passenger_id"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "purpose_snapshot"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "purpose_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transaction_passenger_other_documents_transaction_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transaction_passenger_other_documents_transaction_line_no"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transaction_passenger_other_documents_document_number"`);
        await queryRunner.query(`DROP TABLE "transaction_passenger_other_documents"`);
        await queryRunner.query(`DROP TYPE "public"."transaction_passenger_other_documents_document_type_enum"`);
    }

}
