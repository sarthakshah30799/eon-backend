import { MigrationInterface, QueryRunner } from "typeorm";

export class FakeCurrencyTransactionSchema1785776782431 implements MigrationInterface {
  name = "FakeCurrencyTransactionSchema1785776782431";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transaction_passenger_other_documents" DROP CONSTRAINT "CHK_transaction_passenger_other_documents_document_number_prese"`,
    );
    await queryRunner.query(`ALTER TABLE "transactions" ADD "reason_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD "reason_snapshot" jsonb`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."manual_books_transaction_type_enum" RENAME TO "manual_books_transaction_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."manual_books_transaction_type_enum" AS ENUM('FAKE_CURRENCY', 'PURCHASE_FFMC', 'PURCHASE_CORPORATE_INDIVIDUAL', 'SALE_CORPORATE_INDIVIDUAL', 'SALE_FFMC', 'SALE_RMC', 'SALE_FOREX', 'SALE_FOREIGN', 'SALE_MISC', 'SALE_FRANCHISE', 'PURCHASE_RMC', 'PURCHASE_FOREX', 'PURCHASE_FOREIGN', 'PURCHASE_MISC', 'PURCHASE_FRANCHISE')`,
    );
    await queryRunner.query(
      `ALTER TABLE "manual_books" ALTER COLUMN "transaction_type" TYPE "public"."manual_books_transaction_type_enum" USING "transaction_type"::"text"::"public"."manual_books_transaction_type_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."manual_books_transaction_type_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."transaction_account_postings_source_type_enum" RENAME TO "transaction_account_postings_source_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transaction_account_postings_source_type_enum" AS ENUM('ITEM', 'ITEM_PROFIT', 'ITEM_SALE', 'ROUND_OFF', 'PARTY_CONTROL', 'ADDITIONAL_CHARGE', 'TAX_ITEM', 'TAX_ADDITIONAL_CHARGE', 'AGENT_COMMISSION', 'TDS', 'PAYMENT', 'FAKE_CURRENCY')`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_account_postings" ALTER COLUMN "source_type" TYPE "public"."transaction_account_postings_source_type_enum" USING "source_type"::"text"::"public"."transaction_account_postings_source_type_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."transaction_account_postings_source_type_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transfer_requests" ALTER COLUMN "bill_reference" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ALTER COLUMN "party_profile_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_passenger_other_documents" ADD CONSTRAINT "CHK_transaction_passenger_other_documents_document_number_present" CHECK ("document_number" IS NOT NULL)`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "CHK_transactions_party_profile_required" CHECK (UPPER("slug") = 'FAKE_CURRENCY' OR "party_profile_id" IS NOT NULL)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "CHK_transactions_party_profile_required"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_passenger_other_documents" DROP CONSTRAINT "CHK_transaction_passenger_other_documents_document_number_present"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ALTER COLUMN "party_profile_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "transfer_requests" ALTER COLUMN "bill_reference" DROP NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transaction_account_postings_source_type_enum_old" AS ENUM('ITEM', 'ITEM_PROFIT', 'ITEM_SALE', 'ROUND_OFF', 'PARTY_CONTROL', 'ADDITIONAL_CHARGE', 'TAX_ITEM', 'TAX_ADDITIONAL_CHARGE', 'PAYMENT', 'AGENT_COMMISSION', 'TDS')`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_account_postings" ALTER COLUMN "source_type" TYPE "public"."transaction_account_postings_source_type_enum_old" USING "source_type"::"text"::"public"."transaction_account_postings_source_type_enum_old"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."transaction_account_postings_source_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."transaction_account_postings_source_type_enum_old" RENAME TO "transaction_account_postings_source_type_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."manual_books_transaction_type_enum_old" AS ENUM('PURCHASE_FFMC', 'PURCHASE_CORPORATE_INDIVIDUAL', 'SALE_CORPORATE_INDIVIDUAL', 'SALE_FFMC', 'SALE_RMC', 'SALE_FOREX', 'SALE_FOREIGN', 'SALE_MISC', 'SALE_FRANCHISE', 'PURCHASE_RMC', 'PURCHASE_FOREX', 'PURCHASE_FOREIGN', 'PURCHASE_MISC', 'PURCHASE_FRANCHISE')`,
    );
    await queryRunner.query(
      `ALTER TABLE "manual_books" ALTER COLUMN "transaction_type" TYPE "public"."manual_books_transaction_type_enum_old" USING "transaction_type"::"text"::"public"."manual_books_transaction_type_enum_old"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."manual_books_transaction_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."manual_books_transaction_type_enum_old" RENAME TO "manual_books_transaction_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP COLUMN "reason_snapshot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP COLUMN "reason_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_passenger_other_documents" ADD CONSTRAINT "CHK_transaction_passenger_other_documents_document_number_prese" CHECK ((document_number IS NOT NULL))`,
    );
  }
}
