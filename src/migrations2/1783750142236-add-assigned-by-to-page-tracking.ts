import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAssignedByToPageTracking1783750142236 implements MigrationInterface {
    name = 'AddAssignedByToPageTracking1783750142236'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "manual_book_page_tracking" ADD "assigned_by" uuid`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "manual_book_page_tracking" DROP COLUMN "assigned_by"`);
    }
}
