import { MigrationInterface, QueryRunner } from "typeorm";

export class TransactionsTransactionDateNotNull1787688482547 implements MigrationInterface {
  name = "TransactionsTransactionDateNotNull1787688482547";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Older rows punched before transaction-date policy was enforced.
    await queryRunner.query(`
            UPDATE "transactions"
            SET "transaction_date" = (
                date_trunc('day', timezone('UTC', "created_at")) AT TIME ZONE 'UTC'
            )
            WHERE "transaction_date" IS NULL
        `);
    await queryRunner.query(
      `ALTER TABLE "transactions" ALTER COLUMN "transaction_date" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" ALTER COLUMN "transaction_date" DROP NOT NULL`,
    );
  }
}
