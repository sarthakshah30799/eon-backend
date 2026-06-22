import { MigrationInterface, QueryRunner } from "typeorm";

export class UserRolesExtendsBaseEntity1782153753308 implements MigrationInterface {
    name = 'UserRolesExtendsBaseEntity1782153753308'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_roles" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD "created_by" uuid`);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD "updated_by" uuid`);
        await queryRunner.query(`UPDATE "user_roles" SET "created_by" = '0f5b1fb3-7a63-43f0-ab36-c4896d6ded09' WHERE "created_by" IS NULL`);
        await queryRunner.query(`UPDATE "user_roles" SET "updated_by" = '0f5b1fb3-7a63-43f0-ab36-c4896d6ded09' WHERE "updated_by" IS NULL`);
        await queryRunner.query(`ALTER TABLE "user_roles" ALTER COLUMN "created_by" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_roles" ALTER COLUMN "updated_by" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ALTER COLUMN "active" SET DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "party_profiles" ALTER COLUMN "active" SET DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "user_roles" DROP COLUMN "updated_by"`);
        await queryRunner.query(`ALTER TABLE "user_roles" DROP COLUMN "created_by"`);
        await queryRunner.query(`ALTER TABLE "user_roles" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "user_roles" DROP COLUMN "created_at"`);
    }

}
