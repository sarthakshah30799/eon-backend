import { MigrationInterface, QueryRunner } from "typeorm";

export class FlatDocumentProfiles1782309658051 implements MigrationInterface {
    name = 'FlatDocumentProfiles1782309658051'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "party_profile_documents" DROP CONSTRAINT "FK_party_profile_documents_document_profile_rule_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a874a3baf37bbe03a36459ac62"`);

        await queryRunner.query(`ALTER TABLE "document_profiles" ADD "document_code" citext`);
        await queryRunner.query(`ALTER TABLE "document_profiles" ADD "document_description" citext`);
        await queryRunner.query(`ALTER TABLE "document_profiles" ADD "document_type" text array NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`ALTER TABLE "document_profiles" ADD "is_required" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "document_profiles" ADD "max_size_mb" numeric(10,2) NOT NULL DEFAULT '0'`);

        await queryRunner.query(`
            INSERT INTO "document_profiles" (
                "id",
                "created_at",
                "updated_at",
                "created_by",
                "updated_by",
                "document_code",
                "document_description",
                "document_type",
                "is_required",
                "max_size_mb",
                "specification_type",
                "type",
                "group_selection",
                "entity_selection",
                "active",
                "sort_order"
            )
            SELECT
                rule.id,
                rule.created_at,
                rule.updated_at,
                rule.created_by,
                rule.updated_by,
                UPPER(rule.document_code),
                rule.document_description,
                rule.document_type,
                rule.is_required,
                rule.max_size_mb,
                parent.specification_type,
                parent.type,
                parent.group_selection,
                parent.entity_selection,
                rule.active,
                rule.sort_order
            FROM "document_profile_rules" rule
            INNER JOIN "document_profiles" parent ON parent.id = rule.document_profile_id
        `);

        await queryRunner.query(`UPDATE "party_profile_documents" SET "document_profile_id" = "document_profile_rule_id"`);

        await queryRunner.query(`ALTER TABLE "party_profile_documents" DROP COLUMN "document_profile_rule_id"`);
        await queryRunner.query(`ALTER TABLE "document_profiles" DROP COLUMN "profile_description"`);

        await queryRunner.query(`DELETE FROM "document_profiles" WHERE "id" IN (SELECT DISTINCT "document_profile_id" FROM "document_profile_rules")`);
        await queryRunner.query(`DROP TABLE "document_profile_rules"`);

        await queryRunner.query(`ALTER TABLE "document_profiles" ALTER COLUMN "document_code" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "document_profiles" ALTER COLUMN "document_description" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "document_profiles" ALTER COLUMN "document_type" SET DEFAULT '{}'`);
        await queryRunner.query(`ALTER TABLE "document_profiles" ALTER COLUMN "document_type" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "document_profiles" ALTER COLUMN "is_required" SET DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "document_profiles" ALTER COLUMN "is_required" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "document_profiles" ALTER COLUMN "max_size_mb" SET DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "document_profiles" ALTER COLUMN "max_size_mb" SET NOT NULL`);

        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ccdd58191e37b1a3b5e9d95347" ON "document_profiles" ("document_code") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_394284836d6ee93d5b030c9d7f" ON "party_profile_documents" ("party_profile_id", "document_profile_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_394284836d6ee93d5b030c9d7f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ccdd58191e37b1a3b5e9d95347"`);
        await queryRunner.query(`ALTER TABLE "document_profiles" DROP COLUMN "max_size_mb"`);
        await queryRunner.query(`ALTER TABLE "document_profiles" DROP COLUMN "is_required"`);
        await queryRunner.query(`ALTER TABLE "document_profiles" DROP COLUMN "document_type"`);
        await queryRunner.query(`ALTER TABLE "document_profiles" DROP COLUMN "document_description"`);
        await queryRunner.query(`ALTER TABLE "document_profiles" DROP COLUMN "document_code"`);
        await queryRunner.query(`ALTER TABLE "party_profile_documents" ADD "document_profile_rule_id" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "document_profiles" ADD "profile_description" text`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_a874a3baf37bbe03a36459ac62" ON "party_profile_documents" ("document_profile_rule_id", "party_profile_id") `);
        await queryRunner.query(`ALTER TABLE "party_profile_documents" ADD CONSTRAINT "FK_party_profile_documents_document_profile_rule_id" FOREIGN KEY ("document_profile_rule_id") REFERENCES "document_profile_rules"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
