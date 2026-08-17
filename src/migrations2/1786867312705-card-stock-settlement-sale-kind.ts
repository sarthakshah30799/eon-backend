import { MigrationInterface, QueryRunner } from "typeorm";

export class CardStockSettlementSaleKind1786867312705 implements MigrationInterface {
    name = 'CardStockSettlementSaleKind1786867312705'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "card_stock_settlements" ADD "sale_kind" citext NOT NULL DEFAULT 'FRESH'`);
        await queryRunner.query(`UPDATE "card_stock_settlements" AS settlement SET "sale_kind" = 'RELOAD' FROM "transaction_items" AS item WHERE item.id = settlement.transaction_item_id AND item.is_reload = true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "card_stock_settlements" DROP COLUMN "sale_kind"`);
    }

}
