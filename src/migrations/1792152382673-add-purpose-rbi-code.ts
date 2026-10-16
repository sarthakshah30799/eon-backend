import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPurposeRbiCode1792152382673 implements MigrationInterface {
    name = 'AddPurposeRbiCode1792152382673'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "purposes" ADD "rbi_code" citext`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "purposes" DROP COLUMN "rbi_code"`);
    }

}
