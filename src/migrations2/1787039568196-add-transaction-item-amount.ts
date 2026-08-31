import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTransactionItemAmount1787039568196 implements MigrationInterface {
  name = "AddTransactionItemAmount1787039568196";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transaction_items" ADD "amount" numeric(18,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transaction_items" DROP COLUMN "amount"`,
    );
  }
}
