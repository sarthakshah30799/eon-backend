import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVoucherItemSettledTransaction1788771756018 implements MigrationInterface {
    name = 'AddVoucherItemSettledTransaction1788771756018'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "accounting_voucher_items" ADD "settled_transaction_id" uuid`);
        await queryRunner.query(`ALTER TABLE "accounting_voucher_items" ADD "settled_transaction_snapshot" jsonb`);
        await queryRunner.query(`CREATE INDEX "IDX_accounting_voucher_items_settled_transaction" ON "accounting_voucher_items" ("settled_transaction_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_accounting_voucher_items_settled_transaction"`);
        await queryRunner.query(`ALTER TABLE "accounting_voucher_items" DROP COLUMN "settled_transaction_snapshot"`);
        await queryRunner.query(`ALTER TABLE "accounting_voucher_items" DROP COLUMN "settled_transaction_id"`);
    }

}
