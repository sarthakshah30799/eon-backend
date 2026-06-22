import { MigrationInterface, QueryRunner } from "typeorm";

export class AddHoStaffOnRoles1782133333739 implements MigrationInterface {
    name = 'AddHoStaffOnRoles1782133333739'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "roles"
                ADD COLUMN IF NOT EXISTS "is_ho_staff" boolean NOT NULL DEFAULT false
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "roles"
                DROP COLUMN IF EXISTS "is_ho_staff"
        `);
    }
}
