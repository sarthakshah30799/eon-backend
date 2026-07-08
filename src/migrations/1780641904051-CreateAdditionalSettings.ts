import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAdditionalSettings1780641904051 implements MigrationInterface {
    name = 'CreateAdditionalSettings1780641904051'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."advanced_settings_node_type_enum" AS ENUM('category', 'setting')`);
        await queryRunner.query(`CREATE TYPE "public"."advanced_settings_value_type_enum" AS ENUM('boolean', 'text', 'number', 'decimal', 'date', 'json')`);
        await queryRunner.query(`CREATE TABLE "advanced_settings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "company_id" uuid NOT NULL, "parent_id" uuid, "code" citext NOT NULL, "label" citext NOT NULL, "description" text, "node_type" "public"."advanced_settings_node_type_enum" NOT NULL DEFAULT 'setting', "value_type" "public"."advanced_settings_value_type_enum", "value_boolean" boolean, "value_text" citext, "value_number" integer, "value_decimal" numeric, "value_date" TIMESTAMP WITH TIME ZONE, "value_json" jsonb, "sort_order" integer NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_c28008e0b1cfe03d43adfc1446f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_cdb400011881fefd2ab4309960" ON "advanced_settings" ("company_id", "node_type", "is_active") `);
        await queryRunner.query(`CREATE INDEX "IDX_1ee74dea7da6f310a0307f8783" ON "advanced_settings" ("company_id", "parent_id", "sort_order") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0e1589fade362de11ac8590f36" ON "advanced_settings" ("company_id", "code") `);
        await queryRunner.query(`ALTER TABLE "advanced_settings" ADD CONSTRAINT "FK_ed84ae6aa6e6e9dca2d183e975d" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "advanced_settings" ADD CONSTRAINT "FK_8ff4d104e0b45ed7b4458ddbdf1" FOREIGN KEY ("parent_id") REFERENCES "advanced_settings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "advanced_settings" DROP CONSTRAINT "FK_8ff4d104e0b45ed7b4458ddbdf1"`);
        await queryRunner.query(`ALTER TABLE "advanced_settings" DROP CONSTRAINT "FK_ed84ae6aa6e6e9dca2d183e975d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0e1589fade362de11ac8590f36"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1ee74dea7da6f310a0307f8783"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cdb400011881fefd2ab4309960"`);
        await queryRunner.query(`DROP TABLE "advanced_settings"`);
        await queryRunner.query(`DROP TYPE "public"."advanced_settings_value_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."advanced_settings_node_type_enum"`);
    }

}
