import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Adds products.available_in_deal_cover.
 *
 * Unrelated schema drift found during generate (product_issuers FK constraint
 * hash rename from the product_card_issuers → product_issuers table rename)
 * was excluded from this migration.
 */
export class AddProductAvailableInDealCover1790517243353 implements MigrationInterface {
  name = "AddProductAvailableInDealCover1790517243353";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" ADD "available_in_deal_cover" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" DROP COLUMN "available_in_deal_cover"`,
    );
  }
}
