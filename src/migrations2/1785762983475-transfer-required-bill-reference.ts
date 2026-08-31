import { MigrationInterface, QueryRunner } from "typeorm";

export class TransferRequiredBillReference1785762983475 implements MigrationInterface {
  name = "TransferRequiredBillReference1785762983475";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transaction_passenger_other_documents" DROP CONSTRAINT "CHK_transaction_passenger_other_documents_document_number_prese"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transfer_requests" ALTER COLUMN "bill_reference" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_passenger_other_documents" ADD CONSTRAINT "CHK_transaction_passenger_other_documents_document_number_present" CHECK ("document_number" IS NOT NULL)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transaction_passenger_other_documents" DROP CONSTRAINT "CHK_transaction_passenger_other_documents_document_number_present"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transfer_requests" ALTER COLUMN "bill_reference" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_passenger_other_documents" ADD CONSTRAINT "CHK_transaction_passenger_other_documents_document_number_prese" CHECK ((document_number IS NOT NULL))`,
    );
  }
}
