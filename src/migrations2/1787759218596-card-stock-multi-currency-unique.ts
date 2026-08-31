import { MigrationInterface, QueryRunner } from "typeorm";

export class CardStockMultiCurrencyUnique1787759218596 implements MigrationInterface {
  name = "CardStockMultiCurrencyUnique1787759218596";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "card_stock_transaction_entries"
              DROP CONSTRAINT IF EXISTS "UQ_card_stock_entries_card_operation_reference"
        `);
    await queryRunner.query(`
            ALTER TABLE "card_stock_transaction_entries"
              ADD CONSTRAINT "UQ_card_stock_entries_card_operation_reference"
              UNIQUE ("card_id", "reference_type", "reference_id", "operation_type", "currency_id")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "card_stock_transaction_entries"
              DROP CONSTRAINT IF EXISTS "UQ_card_stock_entries_card_operation_reference"
        `);
    await queryRunner.query(`
            ALTER TABLE "card_stock_transaction_entries"
              ADD CONSTRAINT "UQ_card_stock_entries_card_operation_reference"
              UNIQUE ("card_id", "operation_type", "reference_type", "reference_id")
        `);
  }
}
