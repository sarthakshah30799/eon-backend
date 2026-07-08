import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBranchNameField1780530000000 implements MigrationInterface {
    name = 'AddBranchNameField1780530000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "branches" ADD "name" citext`);
        await queryRunner.query(`UPDATE "branches" SET "name" = "code" WHERE "name" IS NULL`);
        await queryRunner.query(`ALTER TABLE "branches" ALTER COLUMN "name" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "branches" DROP COLUMN "name"`);
    }

}
