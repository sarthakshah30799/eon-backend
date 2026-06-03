import { MigrationInterface, QueryRunner } from "typeorm";

export class AddedIsadminUser1780522696422 implements MigrationInterface {
    name = 'AddedIsadminUser1780522696422'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "is_admin" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "is_admin"`);
    }

}
