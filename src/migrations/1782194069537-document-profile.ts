import { MigrationInterface, QueryRunner } from "typeorm";

export class DocumentProfile1782194069537 implements MigrationInterface {
    name = 'DocumentProfile1782194069537'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "document_profile_rules" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "document_code" citext NOT NULL, "document_description" citext NOT NULL, "document_type" citext NOT NULL, "is_required" boolean NOT NULL DEFAULT false, "max_size_mb" numeric(10,2) NOT NULL DEFAULT '0', "profile_selection" citext, "entity_selection" citext, "field_selection" citext, "field_value" citext, "active" boolean NOT NULL DEFAULT true, "sort_order" integer NOT NULL DEFAULT '0', "document_profile_id" uuid NOT NULL, CONSTRAINT "PK_c00fb4274be6fd983e8f07ec67f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4eb74df094c100abccfcc8ae4b" ON "document_profile_rules" ("document_code") `);
        await queryRunner.query(`CREATE TABLE "document_profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "profile_code" citext NOT NULL, "profile_name" citext NOT NULL, "profile_description" text, "active" boolean NOT NULL DEFAULT true, "sort_order" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_b07e926f3989a03d217c95ccccc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_fba573f488c2c08590aee2103e" ON "document_profiles" ("profile_code") `);
        await queryRunner.query(`ALTER TABLE "document_profile_rules" ADD CONSTRAINT "FK_document_profile_rules_document_profile_id" FOREIGN KEY ("document_profile_id") REFERENCES "document_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "document_profile_rules" DROP CONSTRAINT "FK_document_profile_rules_document_profile_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fba573f488c2c08590aee2103e"`);
        await queryRunner.query(`DROP TABLE "document_profiles"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4eb74df094c100abccfcc8ae4b"`);
        await queryRunner.query(`DROP TABLE "document_profile_rules"`);
    }

}
