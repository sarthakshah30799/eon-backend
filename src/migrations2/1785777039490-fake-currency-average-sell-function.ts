import { MigrationInterface, QueryRunner } from "typeorm";

export class FakeCurrencyAverageSellFunction1785777039490 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE OR REPLACE FUNCTION public.calculate_average_sell_price(p_product_id uuid, p_currency_id uuid) RETURNS numeric LANGUAGE sql STABLE AS $$ SELECT COALESCE(SUM(ti.quantity::numeric * (ti.rate::numeric / NULLIF(COALESCE(ti.per::numeric, 1), 0))) / NULLIF(SUM(ti.quantity::numeric), 0), 0) FROM transaction_items ti INNER JOIN transactions tx ON tx.id = ti.transaction_id WHERE tx.status = 'APPROVED' AND tx.is_latest = true AND tx.transaction_type = 'SALE' AND tx.slug <> 'FAKE_CURRENCY' AND ti.product_id = p_product_id AND ti.currency_id = p_currency_id $$`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS public.calculate_average_sell_price(uuid, uuid)`,
    );
  }
}
