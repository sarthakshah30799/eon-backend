import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBranchStateReference1780477908466 implements MigrationInterface {
    name = 'AddBranchStateReference1780477908466'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "branches" DROP COLUMN "state"`);
        await queryRunner.query(`ALTER TABLE "branches" ADD "country_id" uuid`);
        await queryRunner.query(`ALTER TABLE "branches" ADD "state_id" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_fed78bb626d5d71729ffe2b539" ON "branches" ("country_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_10609b3e27f43d339515a72ef1" ON "branches" ("state_id") `);
        await queryRunner.query(`ALTER TABLE "branches" ADD CONSTRAINT "FK_fed78bb626d5d71729ffe2b5392" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "branches" ADD CONSTRAINT "FK_10609b3e27f43d339515a72ef1f" FOREIGN KEY ("state_id") REFERENCES "states"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "branches" DROP CONSTRAINT "FK_10609b3e27f43d339515a72ef1f"`);
        await queryRunner.query(`ALTER TABLE "branches" DROP CONSTRAINT "FK_fed78bb626d5d71729ffe2b5392"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_10609b3e27f43d339515a72ef1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fed78bb626d5d71729ffe2b539"`);
        await queryRunner.query(`ALTER TABLE "branches" DROP COLUMN "state_id"`);
        await queryRunner.query(`ALTER TABLE "branches" DROP COLUMN "country_id"`);
        await queryRunner.query(`ALTER TABLE "branches" ADD "state" citext NOT NULL`);
    }

}
