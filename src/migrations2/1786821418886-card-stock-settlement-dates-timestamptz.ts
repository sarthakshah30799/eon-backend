import { MigrationInterface, QueryRunner } from "typeorm";

export class CardStockSettlementDatesTimestamptz1786821418886 implements MigrationInterface {
    name = 'CardStockSettlementDatesTimestamptz1786821418886'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "card_stock_settlements" ALTER COLUMN "sale_date" TYPE TIMESTAMP WITH TIME ZONE USING ("sale_date"::timestamp without time zone AT TIME ZONE 'UTC')`);
        await queryRunner.query(`ALTER TABLE "card_stock_settlements" ALTER COLUMN "branch_requested_date" TYPE TIMESTAMP WITH TIME ZONE USING ("branch_requested_date"::timestamp without time zone AT TIME ZONE 'UTC')`);
        await queryRunner.query(`ALTER TABLE "card_stock_settlements" ALTER COLUMN "issuer_settlement_date" TYPE TIMESTAMP WITH TIME ZONE USING ("issuer_settlement_date"::timestamp without time zone AT TIME ZONE 'UTC')`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "card_stock_settlements" ALTER COLUMN "issuer_settlement_date" TYPE date USING (("issuer_settlement_date" AT TIME ZONE 'UTC')::date)`);
        await queryRunner.query(`ALTER TABLE "card_stock_settlements" ALTER COLUMN "branch_requested_date" TYPE date USING (("branch_requested_date" AT TIME ZONE 'UTC')::date)`);
        await queryRunner.query(`ALTER TABLE "card_stock_settlements" ALTER COLUMN "sale_date" TYPE date USING (("sale_date" AT TIME ZONE 'UTC')::date)`);
    }

}
