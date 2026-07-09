import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveApprovalDatesFromManualBooks1783624714510 implements MigrationInterface {
    name = 'RemoveApprovalDatesFromManualBooks1783624714510'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "manual_books" DROP COLUMN IF EXISTS "from_date"`);
        await queryRunner.query(`ALTER TABLE "manual_books" DROP COLUMN IF EXISTS "to_date"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "manual_books" ADD "to_date" date`);
        await queryRunner.query(`ALTER TABLE "manual_books" ADD "from_date" date`);
    }
}
