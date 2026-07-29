import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCdfFieldsToTransactionsGenerated1785346317335 implements MigrationInterface {
    name = 'AddCdfFieldsToTransactionsGenerated1785346317335'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction_passenger_other_documents" DROP CONSTRAINT "CHK_transaction_passenger_other_documents_document_number_prese"`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "cdf_no" citext`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "cdf_issuing_authority" citext`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "cdf_approved_usd" numeric(18,2)`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "cdf_arrival_date" date`);
        await queryRunner.query(`ALTER TABLE "transaction_passenger_other_documents" ADD CONSTRAINT "CHK_transaction_passenger_other_documents_document_number_present" CHECK ("document_number" IS NOT NULL)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction_passenger_other_documents" DROP CONSTRAINT "CHK_transaction_passenger_other_documents_document_number_present"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "cdf_arrival_date"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "cdf_approved_usd"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "cdf_issuing_authority"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "cdf_no"`);
        await queryRunner.query(`ALTER TABLE "transaction_passenger_other_documents" ADD CONSTRAINT "CHK_transaction_passenger_other_documents_document_number_prese" CHECK ((document_number IS NOT NULL))`);
    }

}
