import { MigrationInterface, QueryRunner } from "typeorm";

export class TaxSummaryEntity1784705844391 implements MigrationInterface {
    name = 'TaxSummaryEntity1784705844391'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction_passenger_other_documents" DROP CONSTRAINT "CHK_transaction_passenger_other_documents_document_number_prese"`);
        await queryRunner.query(`CREATE TYPE "public"."transaction_tax_summaries_split_mode_enum" AS ENUM('CGST_SGST', 'IGST')`);
        await queryRunner.query(`CREATE TABLE "transaction_tax_summaries" ("transaction_id" uuid NOT NULL, "tax_rate_percent" numeric(18,4) NOT NULL DEFAULT '0', "taxable_amount" numeric(18,2) NOT NULL DEFAULT '0', "item_base_amount" numeric(18,2) NOT NULL DEFAULT '0', "item_tax_amount" numeric(18,2) NOT NULL DEFAULT '0', "additional_charge_base_amount" numeric(18,2) NOT NULL DEFAULT '0', "additional_charge_tax_amount" numeric(18,2) NOT NULL DEFAULT '0', "igst_amount" numeric(18,2) NOT NULL DEFAULT '0', "cgst_amount" numeric(18,2) NOT NULL DEFAULT '0', "sgst_amount" numeric(18,2) NOT NULL DEFAULT '0', "final_amount" numeric(18,2) NOT NULL DEFAULT '0', "split_mode" "public"."transaction_tax_summaries_split_mode_enum" NOT NULL DEFAULT 'CGST_SGST', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3dc20ec75ea07f32563ea4f57f5" PRIMARY KEY ("transaction_id"))`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "tax_rate_percent" numeric(18,4)`);
        await queryRunner.query(`ALTER TYPE "public"."transaction_account_postings_source_type_enum" RENAME TO "transaction_account_postings_source_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."transaction_account_postings_source_type_enum" AS ENUM('ITEM', 'ITEM_PROFIT', 'ITEM_SALE', 'ROUND_OFF', 'PARTY_CONTROL', 'ADDITIONAL_CHARGE', 'TAX_ITEM', 'TAX_ADDITIONAL_CHARGE', 'PAYMENT')`);
        await queryRunner.query(`ALTER TABLE "transaction_account_postings" ALTER COLUMN "source_type" TYPE "public"."transaction_account_postings_source_type_enum" USING "source_type"::"text"::"public"."transaction_account_postings_source_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transaction_account_postings_source_type_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."transaction_passenger_other_documents_document_type_enum" RENAME TO "transaction_passenger_other_documents_document_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."transaction_passenger_other_documents_document_type_enum" AS ENUM('AADHAAR', 'DRIVING_LICENSE', 'PAN', 'VOTER_ID')`);
        await queryRunner.query(`ALTER TABLE "transaction_passenger_other_documents" ALTER COLUMN "document_type" TYPE "public"."transaction_passenger_other_documents_document_type_enum" USING "document_type"::"text"::"public"."transaction_passenger_other_documents_document_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transaction_passenger_other_documents_document_type_enum_old"`);
        await queryRunner.query(`ALTER TABLE "transaction_passenger_other_documents" ADD CONSTRAINT "CHK_transaction_passenger_other_documents_document_number_present" CHECK ("document_number" IS NOT NULL)`);
        await queryRunner.query(`ALTER TABLE "transaction_tax_summaries" ADD CONSTRAINT "FK_transaction_tax_summaries_transaction_id" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction_tax_summaries" DROP CONSTRAINT "FK_transaction_tax_summaries_transaction_id"`);
        await queryRunner.query(`ALTER TABLE "transaction_passenger_other_documents" DROP CONSTRAINT "CHK_transaction_passenger_other_documents_document_number_present"`);
        await queryRunner.query(`CREATE TYPE "public"."transaction_passenger_other_documents_document_type_enum_old" AS ENUM('AADHAAR', 'DRIVING_LICENSE', 'PAN', 'VOTER_ID')`);
        await queryRunner.query(`ALTER TABLE "transaction_passenger_other_documents" ALTER COLUMN "document_type" TYPE "public"."transaction_passenger_other_documents_document_type_enum_old" USING "document_type"::"text"::"public"."transaction_passenger_other_documents_document_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."transaction_passenger_other_documents_document_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."transaction_passenger_other_documents_document_type_enum_old" RENAME TO "transaction_passenger_other_documents_document_type_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."transaction_account_postings_source_type_enum_old" AS ENUM('ADDITIONAL_CHARGE', 'ITEM', 'ITEM_PROFIT', 'ITEM_SALE', 'PARTY_CONTROL', 'PAYMENT', 'ROUND_OFF')`);
        await queryRunner.query(`ALTER TABLE "transaction_account_postings" ALTER COLUMN "source_type" TYPE "public"."transaction_account_postings_source_type_enum_old" USING "source_type"::"text"::"public"."transaction_account_postings_source_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."transaction_account_postings_source_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."transaction_account_postings_source_type_enum_old" RENAME TO "transaction_account_postings_source_type_enum"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "tax_rate_percent"`);
        await queryRunner.query(`DROP TABLE "transaction_tax_summaries"`);
        await queryRunner.query(`DROP TYPE "public"."transaction_tax_summaries_split_mode_enum"`);
        await queryRunner.query(`ALTER TABLE "transaction_passenger_other_documents" ADD CONSTRAINT "CHK_transaction_passenger_other_documents_document_number_prese" CHECK ((document_number IS NOT NULL))`);
    }

}
