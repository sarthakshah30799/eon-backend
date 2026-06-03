import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIsadminOptionForMenu1780494780250 implements MigrationInterface {
    name = 'AddIsadminOptionForMenu1780494780250'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "menus" ADD "is_admin" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`CREATE INDEX "IDX_642653e3972f5aff259bdec684" ON "menus" ("is_admin") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_642653e3972f5aff259bdec684"`);
        await queryRunner.query(`ALTER TABLE "menus" DROP COLUMN "is_admin"`);
    }

}
