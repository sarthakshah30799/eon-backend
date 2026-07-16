import { MigrationInterface, QueryRunner } from "typeorm";
import { AppDataSource } from "../database/data-source";

export class FixProductSnapshotBackfill1784201664051 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        const affectedRows = (await queryRunner.query(`
            SELECT DISTINCT ti.product_id
            FROM transaction_items ti
            WHERE ti.product_snapshot IS NULL
               OR COALESCE(ti.product_snapshot->>'label', '') = 'Product'
               OR COALESCE(ti.product_snapshot->>'code', '') = ''
               OR COALESCE(ti.product_snapshot->>'name', '') = ''
        `)) as Array<{ product_id: string }>;

        if (!affectedRows.length) {
            return;
        }

        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
        }

        try {
            const productIds = affectedRows.map(row => row.product_id);
            const placeholders = productIds.map((_, index) => `$${index + 1}`).join(", ");
            const products = (await AppDataSource.query(
                `
                    SELECT id, product_code, product_description
                    FROM products
                    WHERE id IN (${placeholders})
                `,
                productIds,
            )) as Array<{ id: string; product_code: string; product_description: string }>;

            const productMap = new Map(
                products.map(product => [
                    product.id,
                    product,
                ]),
            );

            for (const row of affectedRows) {
                const product = productMap.get(row.product_id);
                if (!product) {
                    continue;
                }

                await queryRunner.query(
                    `
                        UPDATE transaction_items
                        SET product_snapshot = COALESCE(product_snapshot, '{}'::jsonb)
                          || jsonb_build_object(
                            'code', $1::text,
                            'name', $2::text,
                            'label', $3::text
                          )
                        WHERE product_id = $4
                          AND (
                            product_snapshot IS NULL
                            OR COALESCE(product_snapshot->>'label', '') = 'Product'
                            OR COALESCE(product_snapshot->>'code', '') = ''
                            OR COALESCE(product_snapshot->>'name', '') = ''
                          )
                    `,
                    [
                        product.product_code,
                        product.product_description,
                        `${product.product_code} - ${product.product_description}`,
                        row.product_id,
                    ],
                );
            }
        } finally {
            if (AppDataSource.isInitialized) {
                await AppDataSource.destroy();
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Data backfill only. No safe rollback for restored snapshot values.
    }

}
