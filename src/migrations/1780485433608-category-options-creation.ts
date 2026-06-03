import { MigrationInterface, QueryRunner } from "typeorm";

export class CategoryOptionsCreation1780485433608 implements MigrationInterface {
    name = 'CategoryOptionsCreation1780485433608'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "category_options" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "code" citext NOT NULL, "value" citext NOT NULL, "label" citext NOT NULL, "sort_order" integer NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_482814c1841fbb02ad31a2843bd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ccc54f321310c687281a6b5831" ON "category_options" ("code", "is_active") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f5bc8ed21baf02c60180653933" ON "category_options" ("code", "value") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_f5bc8ed21baf02c60180653933"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ccc54f321310c687281a6b5831"`);
        await queryRunner.query(`DROP TABLE "category_options"`);
    }

}
