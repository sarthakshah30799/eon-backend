import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCountryGroupsAndRelations1780888888888 implements MigrationInterface {
    name = 'AddCountryGroupsAndRelations1780888888888'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Create country_groups table
        await queryRunner.query(`CREATE TABLE "country_groups" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "name" citext NOT NULL, "code" citext NOT NULL, CONSTRAINT "PK_country_groups" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_country_groups_name" ON "country_groups" ("name")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_country_groups_code" ON "country_groups" ("code")`);

        // 2. Alter countries table to add country_group_id
        await queryRunner.query(`ALTER TABLE "countries" ADD "country_group_id" uuid`);
        await queryRunner.query(`ALTER TABLE "countries" ADD CONSTRAINT "FK_countries_country_group_id" FOREIGN KEY ("country_group_id") REFERENCES "country_groups"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`CREATE INDEX "IDX_countries_country_group_id" ON "countries" ("country_group_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop constraints and columns from countries
        await queryRunner.query(`DROP INDEX "IDX_countries_country_group_id"`);
        await queryRunner.query(`ALTER TABLE "countries" DROP CONSTRAINT "FK_countries_country_group_id"`);
        await queryRunner.query(`ALTER TABLE "countries" DROP COLUMN "country_group_id"`);

        // Drop country_groups table
        await queryRunner.query(`DROP INDEX "IDX_country_groups_code"`);
        await queryRunner.query(`DROP INDEX "IDX_country_groups_name"`);
        await queryRunner.query(`DROP TABLE "country_groups"`);
    }
}
