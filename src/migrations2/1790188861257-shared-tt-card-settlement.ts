import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Generated via `pnpm run migration:generate:db2 shared-tt-card-settlement`.
 * Live DB2 did not yet have deal_covers / remittance (ops migration unrun), so the
 * raw generate also emitted CREATE TABLE deal_covers + remittance + txn item cols.
 * Those belong in 1790103808616-tt-deal-ops-tables.ts — removed here to avoid
 * duplicate create when both migrations run in timestamp order.
 */
export class SharedTtCardSettlement1790188861257 implements MigrationInterface {
  name = "SharedTtCardSettlement1790188861257";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "card_stock_settlements" ADD "type" citext NOT NULL DEFAULT 'CARD'`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_settlements" ADD "deal_cover_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_settlements" ADD "booking_rate" numeric(18,7)`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_settlements" DROP CONSTRAINT "FK_card_stock_settlements_card"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_card_stock_settlements_card_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_settlements" ALTER COLUMN "card_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_card_stock_settlements_deal_item" ON "card_stock_settlements" ("deal_cover_id", "transaction_item_id") WHERE "deal_cover_id" IS NOT NULL AND "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_card_stock_settlements_card_item" ON "card_stock_settlements" ("card_id", "transaction_item_id") WHERE "card_id" IS NOT NULL AND "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_card_stock_settlements_deal_cover" ON "card_stock_settlements" ("deal_cover_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_card_stock_settlements_type" ON "card_stock_settlements" ("type") `,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_settlements" ADD CONSTRAINT "FK_card_stock_settlements_card" FOREIGN KEY ("card_id") REFERENCES "card_stock_cards"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_settlements" ADD CONSTRAINT "FK_card_stock_settlements_deal_cover" FOREIGN KEY ("deal_cover_id") REFERENCES "deal_covers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "card_stock_settlements" DROP CONSTRAINT "FK_card_stock_settlements_deal_cover"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_settlements" DROP CONSTRAINT "FK_card_stock_settlements_card"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_card_stock_settlements_type"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_card_stock_settlements_deal_cover"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_card_stock_settlements_card_item"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_card_stock_settlements_deal_item"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_settlements" ALTER COLUMN "card_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_card_stock_settlements_card_item" ON "card_stock_settlements" ("card_id", "transaction_item_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_settlements" ADD CONSTRAINT "FK_card_stock_settlements_card" FOREIGN KEY ("card_id") REFERENCES "card_stock_cards"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_settlements" DROP COLUMN "booking_rate"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_settlements" DROP COLUMN "deal_cover_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_stock_settlements" DROP COLUMN "type"`,
    );
  }
}
