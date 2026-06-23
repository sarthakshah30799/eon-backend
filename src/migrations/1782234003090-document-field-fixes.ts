import { MigrationInterface, QueryRunner } from "typeorm";

export class DocumentFieldFixes1782234003090 implements MigrationInterface {
    name = 'DocumentFieldFixes1782234003090'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_fba573f488c2c08590aee2103e"`);
        await queryRunner.query(`ALTER TABLE "document_profile_rules" DROP COLUMN "profile_selection"`);
        await queryRunner.query(`ALTER TABLE "document_profile_rules" DROP COLUMN "entity_selection"`);
        await queryRunner.query(`ALTER TABLE "document_profile_rules" DROP COLUMN "field_selection"`);
        await queryRunner.query(`ALTER TABLE "document_profile_rules" DROP COLUMN "field_value"`);
        await queryRunner.query(`ALTER TABLE "document_profiles" DROP COLUMN "profile_code"`);
        await queryRunner.query(`ALTER TABLE "document_profiles" DROP COLUMN "profile_name"`);
        await queryRunner.query(`ALTER TABLE "document_profiles" ADD "specification_type" citext NOT NULL`);
        await queryRunner.query(`ALTER TABLE "document_profiles" ADD "type" citext NOT NULL`);
        await queryRunner.query(`ALTER TABLE "document_profiles" ADD "group_selection" citext`);
        await queryRunner.query(`ALTER TABLE "document_profiles" ADD "entity_selection" citext`);
        await queryRunner.query(`ALTER TABLE "document_profile_rules" DROP COLUMN "document_type"`);
        await queryRunner.query(`ALTER TABLE "document_profile_rules" ADD "document_type" text array NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_7742c71276e146ea2875340cc4" ON "document_profiles" ("specification_type") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_7742c71276e146ea2875340cc4"`);
        await queryRunner.query(`ALTER TABLE "document_profile_rules" DROP COLUMN "document_type"`);
        await queryRunner.query(`ALTER TABLE "document_profile_rules" ADD "document_type" citext NOT NULL`);
        await queryRunner.query(`ALTER TABLE "document_profiles" DROP COLUMN "entity_selection"`);
        await queryRunner.query(`ALTER TABLE "document_profiles" DROP COLUMN "group_selection"`);
        await queryRunner.query(`ALTER TABLE "document_profiles" DROP COLUMN "type"`);
        await queryRunner.query(`ALTER TABLE "document_profiles" DROP COLUMN "specification_type"`);
        await queryRunner.query(`ALTER TABLE "document_profiles" ADD "profile_name" citext NOT NULL`);
        await queryRunner.query(`ALTER TABLE "document_profiles" ADD "profile_code" citext NOT NULL`);
        await queryRunner.query(`ALTER TABLE "document_profile_rules" ADD "field_value" citext`);
        await queryRunner.query(`ALTER TABLE "document_profile_rules" ADD "field_selection" citext`);
        await queryRunner.query(`ALTER TABLE "document_profile_rules" ADD "entity_selection" citext`);
        await queryRunner.query(`ALTER TABLE "document_profile_rules" ADD "profile_selection" citext`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_fba573f488c2c08590aee2103e" ON "document_profiles" ("profile_code") `);
    }

}
