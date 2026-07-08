import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserResetPasswordField1780511291000 implements MigrationInterface {
    name = 'AddUserResetPasswordField1780511291000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "must_change_password" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "must_change_password"`);
    }

}
