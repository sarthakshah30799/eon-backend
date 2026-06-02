import { MigrationInterface, QueryRunner } from "typeorm";

export class AddResetPasswordFields1779876543210 implements MigrationInterface {
    name = 'AddResetPasswordFields1779876543210'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "resetPasswordToken" text`);
        await queryRunner.query(`ALTER TABLE "users" ADD "resetPasswordExpires" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "resetPasswordToken"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "resetPasswordExpires"`);
    }
}
