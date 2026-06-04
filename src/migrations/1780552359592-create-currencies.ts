import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCurrencies1780552359592 implements MigrationInterface {
    name = 'CreateCurrencies1780552359592'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "currencies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "currency_code" citext NOT NULL, "currency_name" citext NOT NULL, "priority" citext NOT NULL, "rate_per" citext NOT NULL, "default_min_rate" citext NOT NULL, "default_max_rate" citext NOT NULL, "calculation_method" citext NOT NULL DEFAULT 'MULTIPLICATION', "open_rate_premium" citext NOT NULL, "gulf_disc_factor" citext NOT NULL, "amex_map_code" citext NOT NULL, "group" citext NOT NULL DEFAULT 'ASIA', "active" boolean NOT NULL DEFAULT false, "only_stocking" boolean NOT NULL DEFAULT false, "product_allowed" citext NOT NULL DEFAULT '', "country_id" uuid NOT NULL, CONSTRAINT "UQ_46b8e68b649433979094a8c50e1" UNIQUE ("currency_code"), CONSTRAINT "PK_d528c54860c4182db13548e08c4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_46b8e68b649433979094a8c50e" ON "currencies" ("currency_code") `);
        await queryRunner.query(`CREATE INDEX "IDX_8ee6ff98e79c5bc234fba43d61" ON "currencies" ("country_id") `);
        await queryRunner.query(`ALTER TABLE "currencies" ADD CONSTRAINT "FK_8ee6ff98e79c5bc234fba43d617" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "currencies" DROP CONSTRAINT "FK_8ee6ff98e79c5bc234fba43d617"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8ee6ff98e79c5bc234fba43d61"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_46b8e68b649433979094a8c50e"`);
        await queryRunner.query(`DROP TABLE "currencies"`);
    }

}
