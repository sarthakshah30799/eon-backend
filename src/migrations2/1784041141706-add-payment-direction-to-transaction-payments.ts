import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPaymentDirectionToTransactionPayments1784041141706
  implements MigrationInterface
{
  name = "AddPaymentDirectionToTransactionPayments1784041141706";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."transaction_payments_direction_enum" AS ENUM('PAYMENT', 'RECEIPT')`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_payments" ADD "payment_direction" "public"."transaction_payments_direction_enum"`,
    );
    await queryRunner.query(
      `UPDATE "transaction_payments" tp SET "payment_direction" = CASE WHEN t."transaction_type" = 'SALE' THEN 'RECEIPT'::"public"."transaction_payments_direction_enum" ELSE 'PAYMENT'::"public"."transaction_payments_direction_enum" END FROM "transactions" t WHERE t."id" = tp."transaction_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_payments" ALTER COLUMN "payment_direction" SET DEFAULT 'PAYMENT'`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_payments" ALTER COLUMN "payment_direction" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transaction_payments" DROP COLUMN "payment_direction"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."transaction_payments_direction_enum"`,
    );
  }
}
