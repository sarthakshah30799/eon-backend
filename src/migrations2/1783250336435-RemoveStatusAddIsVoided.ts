import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveStatusAddIsVoided1783250336435 implements MigrationInterface {
    name = 'RemoveStatusAddIsVoided1783250336435'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop columns status
        await queryRunner.query(`ALTER TABLE "manual_book_page_tracking" DROP COLUMN "status"`);
        await queryRunner.query(`ALTER TABLE "cheque_book_page_tracking" DROP COLUMN "status"`);

        // Add is_voided boolean column
        await queryRunner.query(`ALTER TABLE "manual_book_page_tracking" ADD "is_voided" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "cheque_book_page_tracking" ADD "is_voided" boolean NOT NULL DEFAULT false`);

        // Drop enum types
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."manual_book_page_tracking_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."cheque_book_page_tracking_status_enum"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Re-create enum types
        await queryRunner.query(`CREATE TYPE "public"."cheque_book_page_tracking_status_enum" AS ENUM('ALLOCATED', 'USED', 'VOID')`);
        await queryRunner.query(`CREATE TYPE "public"."manual_book_page_tracking_status_enum" AS ENUM('ALLOCATED', 'USED', 'VOID')`);

        // Drop is_voided columns
        await queryRunner.query(`ALTER TABLE "cheque_book_page_tracking" DROP COLUMN "is_voided"`);
        await queryRunner.query(`ALTER TABLE "manual_book_page_tracking" DROP COLUMN "is_voided"`);

        // Re-add status columns
        await queryRunner.query(`ALTER TABLE "cheque_book_page_tracking" ADD "status" "public"."cheque_book_page_tracking_status_enum" NOT NULL DEFAULT 'ALLOCATED'`);
        await queryRunner.query(`ALTER TABLE "manual_book_page_tracking" ADD "status" "public"."manual_book_page_tracking_status_enum" NOT NULL DEFAULT 'ALLOCATED'`);
    }

}
