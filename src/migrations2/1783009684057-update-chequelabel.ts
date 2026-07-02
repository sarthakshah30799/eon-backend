import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateChequelabel1783009684057 implements MigrationInterface {
    name = 'UpdateChequelabel1783009684057'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "check_books" RENAME TO "cheque_books"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cheque_books" RENAME TO "check_books"`);
    }

}
