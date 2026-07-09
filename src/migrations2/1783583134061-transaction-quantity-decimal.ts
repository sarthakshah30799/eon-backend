import { MigrationInterface, QueryRunner } from "typeorm";

export class TransactionQuantityDecimal1783583134061 implements MigrationInterface {
    name = 'TransactionQuantityDecimal1783583134061'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction_items" ALTER COLUMN "quantity" TYPE numeric(18,7)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaction_items" ALTER COLUMN "quantity" TYPE numeric(18,4)`);
    }

}
