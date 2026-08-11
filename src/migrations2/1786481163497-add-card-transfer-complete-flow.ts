import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCardTransferCompleteFlow1786481163497 implements MigrationInterface {
    name = 'AddCardTransferCompleteFlow1786481163497'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "card_transfer_request_cards" ADD "transfer_id" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "card_transfer_requests" ADD "acceptance_remarks" text`);
        await queryRunner.query(`ALTER TABLE "card_transfer_requests" ADD "rejection_reason" text`);
        await queryRunner.query(`ALTER TABLE "card_transfer_requests" ADD "cancellation_reason" text`);
        await queryRunner.query(`ALTER TABLE "card_transfer_requests" ADD "cancelled_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "card_transfer_requests" ADD "cancelled_by_id" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_card_transfer_request_items_transfer_id" ON "card_transfer_request_items" ("transfer_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_card_transfer_request_cards_transfer_card" ON "card_transfer_request_cards" ("transfer_id", "card_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_card_transfer_requests_transaction_date" ON "card_transfer_requests" ("transaction_date") `);
        await queryRunner.query(`ALTER TABLE "card_transfer_request_cards" ADD CONSTRAINT "FK_card_transfer_request_cards_transfer" FOREIGN KEY ("transfer_id") REFERENCES "card_transfer_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "card_transfer_request_cards" DROP CONSTRAINT "FK_card_transfer_request_cards_transfer"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_card_transfer_requests_transaction_date"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_card_transfer_request_cards_transfer_card"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_card_transfer_request_items_transfer_id"`);
        await queryRunner.query(`ALTER TABLE "card_transfer_requests" DROP COLUMN "cancelled_by_id"`);
        await queryRunner.query(`ALTER TABLE "card_transfer_requests" DROP COLUMN "cancelled_at"`);
        await queryRunner.query(`ALTER TABLE "card_transfer_requests" DROP COLUMN "cancellation_reason"`);
        await queryRunner.query(`ALTER TABLE "card_transfer_requests" DROP COLUMN "rejection_reason"`);
        await queryRunner.query(`ALTER TABLE "card_transfer_requests" DROP COLUMN "acceptance_remarks"`);
        await queryRunner.query(`ALTER TABLE "card_transfer_request_cards" DROP COLUMN "transfer_id"`);
    }

}
