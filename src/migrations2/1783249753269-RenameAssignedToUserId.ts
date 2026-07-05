import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameAssignedToUserId1783249753269 implements MigrationInterface {
    name = 'RenameAssignedToUserId1783249753269'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_manual_book_page_tracking_user"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cheque_book_page_tracking_user"`);
        await queryRunner.query(`ALTER TABLE "manual_book_page_tracking" RENAME COLUMN "assigned_to_user_id" TO "user_id"`);
        await queryRunner.query(`ALTER TABLE "cheque_book_page_tracking" RENAME COLUMN "assigned_to_user_id" TO "user_id"`);
        await queryRunner.query(`CREATE INDEX "IDX_manual_book_page_tracking_user" ON "manual_book_page_tracking" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_cheque_book_page_tracking_user" ON "cheque_book_page_tracking" ("user_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_cheque_book_page_tracking_user"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_manual_book_page_tracking_user"`);
        await queryRunner.query(`ALTER TABLE "cheque_book_page_tracking" RENAME COLUMN "user_id" TO "assigned_to_user_id"`);
        await queryRunner.query(`ALTER TABLE "manual_book_page_tracking" RENAME COLUMN "user_id" TO "assigned_to_user_id"`);
        await queryRunner.query(`CREATE INDEX "IDX_cheque_book_page_tracking_user" ON "cheque_book_page_tracking" ("assigned_to_user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_manual_book_page_tracking_user" ON "manual_book_page_tracking" ("assigned_to_user_id") `);
    }

}
