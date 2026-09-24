import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Non-entity CHECK — not expressible via TypeORM column decorators.
 * Created with `migration:create` after entity generate for shared TT/CARD settlements.
 */
export class CardStockSettlementTypeCheck1790188967557
  implements MigrationInterface
{
  name = "CardStockSettlementTypeCheck1790188967557";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "card_stock_settlements" ADD CONSTRAINT "CHK_card_stock_settlements_type_refs" CHECK (
        ("type" = 'CARD' AND "card_id" IS NOT NULL AND "deal_cover_id" IS NULL)
        OR ("type" = 'TT' AND "deal_cover_id" IS NOT NULL AND "card_id" IS NULL)
      )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "card_stock_settlements" DROP CONSTRAINT "CHK_card_stock_settlements_type_refs"`,
    );
  }
}
