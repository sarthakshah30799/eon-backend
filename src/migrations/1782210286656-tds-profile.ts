import { MigrationInterface, QueryRunner } from "typeorm";

export class TdsProfile1782210286656 implements MigrationInterface {
    name = 'TdsProfile1782210286656'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "tds_profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "code" citext NOT NULL, "name" citext NOT NULL, "description" text, "active" boolean NOT NULL DEFAULT true, "sort_order" integer NOT NULL DEFAULT '0', "from" TIMESTAMP WITH TIME ZONE, "to" TIMESTAMP WITH TIME ZONE, "value" numeric(10,2) NOT NULL, CONSTRAINT "PK_9c60de20281d1d86957cc246a9f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_d6a2bbb4a86999ae3ffab57c0d" ON "tds_profiles" ("code") `);
        await queryRunner.query(`CREATE INDEX "IDX_df20546fd0640ad47efb9752f8" ON "tds_profiles" ("sort_order") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_df20546fd0640ad47efb9752f8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d6a2bbb4a86999ae3ffab57c0d"`);
        await queryRunner.query(`DROP TABLE "tds_profiles"`);
    }

}
