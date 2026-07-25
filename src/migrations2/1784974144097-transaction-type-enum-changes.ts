import { MigrationInterface, QueryRunner } from "typeorm";

export class TransactionTypeEnumChanges1784974144097 implements MigrationInterface {
    name = 'TransactionTypeEnumChanges1784974144097'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TRIGGER IF EXISTS transaction_header_tax_breakdown_refresh_trigger ON "transactions"`);
        await queryRunner.query(`DROP TRIGGER IF EXISTS transaction_tcs_refresh_trigger ON "transactions"`);
        await queryRunner.query(`ALTER TABLE "transaction_passenger_other_documents" DROP CONSTRAINT "CHK_transaction_passenger_other_documents_document_number_prese"`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_transaction_party_profile_type_enum" AS ENUM('FFMC', 'CORPORATE', 'INDIVIDUAL', 'RMC', 'FRANCHISE', 'FOREX', 'MISC')`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "transaction_party_profile_type" "public"."transactions_transaction_party_profile_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."manual_books_transaction_type_enum" RENAME TO "manual_books_transaction_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."manual_books_transaction_type_enum" AS ENUM('PURCHASE_FFMC', 'PURCHASE_CORPORATE_INDIVIDUAL', 'SALE_CORPORATE_INDIVIDUAL', 'SALE_FFMC', 'SALE_RMC', 'SALE_FOREX', 'SALE_FOREIGN', 'SALE_MISC', 'SALE_FRANCHISE', 'PURCHASE_RMC', 'PURCHASE_FOREX', 'PURCHASE_FOREIGN', 'PURCHASE_MISC', 'PURCHASE_FRANCHISE')`);
        await queryRunner.query(`ALTER TABLE "manual_books" ALTER COLUMN "transaction_type" TYPE "public"."manual_books_transaction_type_enum" USING "transaction_type"::"text"::"public"."manual_books_transaction_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."manual_books_transaction_type_enum_old"`);
        await queryRunner.query(`ALTER TABLE "transaction_items" ALTER COLUMN "tax_rate_percent" TYPE numeric(18,2)`);
        await queryRunner.query(`ALTER TABLE "transaction_items" ALTER COLUMN "igst_rate_percent" TYPE numeric(18,2)`);
        await queryRunner.query(`ALTER TABLE "transaction_items" ALTER COLUMN "cgst_rate_percent" TYPE numeric(18,2)`);
        await queryRunner.query(`ALTER TABLE "transaction_items" ALTER COLUMN "sgst_rate_percent" TYPE numeric(18,2)`);
        await queryRunner.query(`ALTER TABLE "transaction_additional_charges" ALTER COLUMN "amount" TYPE numeric(18,2)`);
        await queryRunner.query(`ALTER TABLE "transaction_additional_charges" ALTER COLUMN "gst_rate" TYPE numeric(18,2)`);
        await queryRunner.query(`ALTER TABLE "transaction_additional_charges" ALTER COLUMN "gst_amount" TYPE numeric(18,2)`);
        await queryRunner.query(`ALTER TABLE "transaction_additional_charges" ALTER COLUMN "tax_rate_percent" TYPE numeric(18,2)`);
        await queryRunner.query(`ALTER TABLE "transaction_additional_charges" ALTER COLUMN "igst_rate_percent" TYPE numeric(18,2)`);
        await queryRunner.query(`ALTER TABLE "transaction_additional_charges" ALTER COLUMN "cgst_rate_percent" TYPE numeric(18,2)`);
        await queryRunner.query(`ALTER TABLE "transaction_additional_charges" ALTER COLUMN "sgst_rate_percent" TYPE numeric(18,2)`);
        await queryRunner.query(`ALTER TABLE "transaction_payments" ALTER COLUMN "amount" TYPE numeric(18,2)`);
        await queryRunner.query(`ALTER TABLE "transaction_tcs_breakdowns" ALTER COLUMN "rate_percent" TYPE numeric(18,2)`);
        await queryRunner.query(`ALTER TYPE "public"."transaction_passenger_other_documents_document_type_enum" RENAME TO "transaction_passenger_other_documents_document_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."transaction_passenger_other_documents_document_type_enum" AS ENUM('AADHAAR', 'DRIVING_LICENSE', 'PAN', 'VOTER_ID')`);
        await queryRunner.query(`ALTER TABLE "transaction_passenger_other_documents" ALTER COLUMN "document_type" TYPE "public"."transaction_passenger_other_documents_document_type_enum" USING "document_type"::"text"::"public"."transaction_passenger_other_documents_document_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transaction_passenger_other_documents_document_type_enum_old"`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "tax_rate_percent" TYPE numeric(18,2)`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "tcs_rate_percent" TYPE numeric(18,2)`);
        await queryRunner.query(`CREATE TRIGGER transaction_header_tax_breakdown_refresh_trigger AFTER INSERT OR UPDATE OF transaction_type, tax_rate_percent, branch_snapshot, party_profile_snapshot ON "transactions" FOR EACH ROW EXECUTE FUNCTION public.transaction_header_tax_breakdown_refresh_trigger()`);
        await queryRunner.query(`CREATE TRIGGER transaction_tcs_refresh_trigger AFTER INSERT OR UPDATE OF transaction_type, item_base_amount, item_tax_amount, additional_charge_base_amount, additional_charge_tax_amount, loan_amount, declared_amount, itr_filed, tcs_declaration_accepted, is_proprietorship, purpose_snapshot ON "transactions" FOR EACH ROW EXECUTE FUNCTION public.transaction_tcs_refresh_trigger()`);
        await queryRunner.query(`CREATE INDEX "IDX_transactions_party_profile_type" ON "transactions" ("transaction_party_profile_type") `);
        await queryRunner.query(`ALTER TABLE "transaction_passenger_other_documents" ADD CONSTRAINT "CHK_transaction_passenger_other_documents_document_number_present" CHECK ("document_number" IS NOT NULL)`);
          await queryRunner.query(`
      UPDATE "transactions"
      SET "transaction_party_profile_type" = CASE UPPER(COALESCE("slug", ''))
        WHEN 'PURCHASE_CORPORATE' THEN 'CORPORATE'
        WHEN 'SALE_CORPORATE' THEN 'CORPORATE'
        WHEN 'PURCHASE_CORPORATE_INDIVIDUAL' THEN 'CORPORATE'
        WHEN 'SALE_CORPORATE_INDIVIDUAL' THEN 'CORPORATE'
        WHEN 'PURCHASE_INDIVIDUAL' THEN 'INDIVIDUAL'
        WHEN 'SALE_INDIVIDUAL' THEN 'INDIVIDUAL'
        WHEN 'PURCHASE_FFMC' THEN 'FFMC'
        WHEN 'SALE_FFMC' THEN 'FFMC'
        WHEN 'PURCHASE_RMC' THEN 'RMC'
        WHEN 'SALE_RMC' THEN 'RMC'
        WHEN 'PURCHASE_FOREX' THEN 'FOREX'
        WHEN 'SALE_FOREX' THEN 'FOREX'
        WHEN 'PURCHASE_FRANCHISE' THEN 'FRANCHISE'
        WHEN 'SALE_FRANCHISE' THEN 'FRANCHISE'
        WHEN 'PURCHASE_MISC' THEN 'MISC'
        WHEN 'SALE_MISC' THEN 'MISC'
        ELSE NULL
      END::"public"."transactions_transaction_party_profile_type_enum"
      WHERE "transaction_party_profile_type" IS NULL;
    `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TRIGGER IF EXISTS transaction_header_tax_breakdown_refresh_trigger ON "transactions"`);
        await queryRunner.query(`DROP TRIGGER IF EXISTS transaction_tcs_refresh_trigger ON "transactions"`);
        await queryRunner.query(`ALTER TABLE "transaction_passenger_other_documents" DROP CONSTRAINT "CHK_transaction_passenger_other_documents_document_number_present"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_transactions_party_profile_type"`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "tcs_rate_percent" TYPE numeric(18,4)`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "tax_rate_percent" TYPE numeric(18,4)`);
        await queryRunner.query(`CREATE TYPE "public"."transaction_passenger_other_documents_document_type_enum_old" AS ENUM('AADHAAR', 'DRIVING_LICENSE', 'PAN', 'VOTER_ID')`);
        await queryRunner.query(`ALTER TABLE "transaction_passenger_other_documents" ALTER COLUMN "document_type" TYPE "public"."transaction_passenger_other_documents_document_type_enum_old" USING "document_type"::"text"::"public"."transaction_passenger_other_documents_document_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."transaction_passenger_other_documents_document_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."transaction_passenger_other_documents_document_type_enum_old" RENAME TO "transaction_passenger_other_documents_document_type_enum"`);
        await queryRunner.query(`ALTER TABLE "transaction_tcs_breakdowns" ALTER COLUMN "rate_percent" TYPE numeric(18,4)`);
        await queryRunner.query(`ALTER TABLE "transaction_payments" ALTER COLUMN "amount" TYPE numeric(18,4)`);
        await queryRunner.query(`ALTER TABLE "transaction_additional_charges" ALTER COLUMN "sgst_rate_percent" TYPE numeric(18,4)`);
        await queryRunner.query(`ALTER TABLE "transaction_additional_charges" ALTER COLUMN "cgst_rate_percent" TYPE numeric(18,4)`);
        await queryRunner.query(`ALTER TABLE "transaction_additional_charges" ALTER COLUMN "igst_rate_percent" TYPE numeric(18,4)`);
        await queryRunner.query(`ALTER TABLE "transaction_additional_charges" ALTER COLUMN "tax_rate_percent" TYPE numeric(18,4)`);
        await queryRunner.query(`ALTER TABLE "transaction_additional_charges" ALTER COLUMN "gst_amount" TYPE numeric(18,4)`);
        await queryRunner.query(`ALTER TABLE "transaction_additional_charges" ALTER COLUMN "gst_rate" TYPE numeric(18,4)`);
        await queryRunner.query(`ALTER TABLE "transaction_additional_charges" ALTER COLUMN "amount" TYPE numeric(18,4)`);
        await queryRunner.query(`ALTER TABLE "transaction_items" ALTER COLUMN "sgst_rate_percent" TYPE numeric(18,4)`);
        await queryRunner.query(`ALTER TABLE "transaction_items" ALTER COLUMN "cgst_rate_percent" TYPE numeric(18,4)`);
        await queryRunner.query(`ALTER TABLE "transaction_items" ALTER COLUMN "igst_rate_percent" TYPE numeric(18,4)`);
        await queryRunner.query(`ALTER TABLE "transaction_items" ALTER COLUMN "tax_rate_percent" TYPE numeric(18,4)`);
        await queryRunner.query(`CREATE TYPE "public"."manual_books_transaction_type_enum_old" AS ENUM('PURCHASE_CORPORATE', 'PURCHASE_FFMC', 'PURCHASE_FOREIGN', 'PURCHASE_FOREX', 'PURCHASE_FRANCHISE', 'PURCHASE_INDIVIDUAL', 'PURCHASE_MISC', 'PURCHASE_RMC', 'SALE_FFMC', 'SALE_FOREIGN', 'SALE_FOREX', 'SALE_FRANCHISE', 'SALE_MISC', 'SALE_RMC')`);
        await queryRunner.query(`ALTER TABLE "manual_books" ALTER COLUMN "transaction_type" TYPE "public"."manual_books_transaction_type_enum_old" USING "transaction_type"::"text"::"public"."manual_books_transaction_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."manual_books_transaction_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."manual_books_transaction_type_enum_old" RENAME TO "manual_books_transaction_type_enum"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "transaction_party_profile_type"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_transaction_party_profile_type_enum"`);
        await queryRunner.query(`ALTER TABLE "transaction_passenger_other_documents" ADD CONSTRAINT "CHK_transaction_passenger_other_documents_document_number_prese" CHECK ((document_number IS NOT NULL))`);
        await queryRunner.query(`CREATE TRIGGER transaction_header_tax_breakdown_refresh_trigger AFTER INSERT OR UPDATE OF transaction_type, tax_rate_percent, branch_snapshot, party_profile_snapshot ON "transactions" FOR EACH ROW EXECUTE FUNCTION public.transaction_header_tax_breakdown_refresh_trigger()`);
        await queryRunner.query(`CREATE TRIGGER transaction_tcs_refresh_trigger AFTER INSERT OR UPDATE OF transaction_type, item_base_amount, item_tax_amount, additional_charge_base_amount, additional_charge_tax_amount, loan_amount, declared_amount, itr_filed, tcs_declaration_accepted, is_proprietorship, purpose_snapshot ON "transactions" FOR EACH ROW EXECUTE FUNCTION public.transaction_tcs_refresh_trigger()`);
    }

}
