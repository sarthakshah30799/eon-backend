import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPassengerEntity1784634479167 implements MigrationInterface {
    name = 'AddPassengerEntity1784634479167'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."passengers_entity_type_enum" AS ENUM('CORPORATE', 'INDIVIDUAL')`);
        await queryRunner.query(`CREATE TYPE "public"."passengers_nationality_type_enum" AS ENUM('INDIAN', 'NRI', 'FOREIGNER')`);
        await queryRunner.query(`CREATE TYPE "public"."passengers_pan_holder_relation_type_enum" AS ENUM('COMPANY', 'INDIVIDUAL')`);
        await queryRunner.query(`CREATE TYPE "public"."passengers_corporate_pan_holder_relation_type_enum" AS ENUM('COMPANY', 'INDIVIDUAL')`);
        await queryRunner.query(`CREATE TABLE "passengers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "party_profile_id" uuid NOT NULL, "entity_type" "public"."passengers_entity_type_enum" NOT NULL, "nationality_type" "public"."passengers_nationality_type_enum" NOT NULL, "country_id" uuid NOT NULL, "resident_status_id" uuid, "location_id" uuid, "email" citext, "contact_no" citext, "pan_number" citext, "pan_holder_name" citext, "pan_dob" date, "pan_holder_relation_type" "public"."passengers_pan_holder_relation_type_enum", "paid_by_pan_number" citext, "paid_by_pan_holder_name" citext, "paid_by_pan_dob" date, "corporate_pan_number" citext, "corporate_pan_holder_name" citext, "corporate_pan_dob" date, "corporate_pan_holder_relation_type" "public"."passengers_corporate_pan_holder_relation_type_enum", "gst_state_id" uuid, "gst_number" citext, "address_1" citext, "address_2" citext, "city" citext, "state_id" uuid, "passport_number" citext, "passport_issue_at" citext, "passport_issue_date" date, "passport_expiry_date" date, "arrival_date" date, "is_pep" boolean NOT NULL DEFAULT false, "remarks" text, CONSTRAINT "CHK_passengers_corporate_pan_holder_present" CHECK ("corporate_pan_number" IS NULL OR "corporate_pan_holder_name" IS NOT NULL), CONSTRAINT "CHK_passengers_pan_holder_present" CHECK ("pan_number" IS NULL OR "pan_holder_name" IS NOT NULL), CONSTRAINT "CHK_passengers_passport_date_order" CHECK ("passport_issue_date" IS NULL OR "passport_expiry_date" IS NULL OR "passport_expiry_date" >= "passport_issue_date"), CONSTRAINT "CHK_passengers_country_required" CHECK ("country_id" IS NOT NULL), CONSTRAINT "CHK_passengers_party_profile_required" CHECK ("party_profile_id" IS NOT NULL), CONSTRAINT "PK_9863c72acd866e4529f65c6c98c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_passengers_passport_number" ON "passengers" ("passport_number") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_passengers_corporate_pan_number" ON "passengers" ("corporate_pan_number") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_passengers_pan_number" ON "passengers" ("pan_number") `);
        await queryRunner.query(`CREATE INDEX "IDX_passengers_gst_state_id" ON "passengers" ("gst_state_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_passengers_state_id" ON "passengers" ("state_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_passengers_country_id" ON "passengers" ("country_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_passengers_nationality_type" ON "passengers" ("nationality_type") `);
        await queryRunner.query(`CREATE INDEX "IDX_passengers_entity_type" ON "passengers" ("entity_type") `);
        await queryRunner.query(`CREATE INDEX "IDX_passengers_party_profile_id" ON "passengers" ("party_profile_id") `);
        await queryRunner.query(`ALTER TABLE "passengers" ADD CONSTRAINT "FK_passengers_party_profile_id" FOREIGN KEY ("party_profile_id") REFERENCES "party_profiles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "passengers" ADD CONSTRAINT "FK_passengers_country_id" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "passengers" ADD CONSTRAINT "FK_passengers_resident_status_id" FOREIGN KEY ("resident_status_id") REFERENCES "category_options"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "passengers" ADD CONSTRAINT "FK_passengers_location_id" FOREIGN KEY ("location_id") REFERENCES "category_options"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "passengers" ADD CONSTRAINT "FK_passengers_gst_state_id" FOREIGN KEY ("gst_state_id") REFERENCES "states"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "passengers" ADD CONSTRAINT "FK_passengers_state_id" FOREIGN KEY ("state_id") REFERENCES "states"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "passengers" DROP CONSTRAINT "FK_passengers_state_id"`);
        await queryRunner.query(`ALTER TABLE "passengers" DROP CONSTRAINT "FK_passengers_gst_state_id"`);
        await queryRunner.query(`ALTER TABLE "passengers" DROP CONSTRAINT "FK_passengers_location_id"`);
        await queryRunner.query(`ALTER TABLE "passengers" DROP CONSTRAINT "FK_passengers_resident_status_id"`);
        await queryRunner.query(`ALTER TABLE "passengers" DROP CONSTRAINT "FK_passengers_country_id"`);
        await queryRunner.query(`ALTER TABLE "passengers" DROP CONSTRAINT "FK_passengers_party_profile_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_passengers_party_profile_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_passengers_entity_type"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_passengers_nationality_type"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_passengers_country_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_passengers_state_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_passengers_gst_state_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_passengers_pan_number"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_passengers_corporate_pan_number"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_passengers_passport_number"`);
        await queryRunner.query(`DROP TABLE "passengers"`);
        await queryRunner.query(`DROP TYPE "public"."passengers_corporate_pan_holder_relation_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."passengers_pan_holder_relation_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."passengers_nationality_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."passengers_entity_type_enum"`);
    }

}
