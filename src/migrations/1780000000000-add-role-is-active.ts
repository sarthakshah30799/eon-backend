import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRoleIsActive1780000000000 implements MigrationInterface {
    name = 'AddRoleIsActive1780000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "roles" ADD "isActive" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "roles" DROP COLUMN "isActive"`);
    }
}
