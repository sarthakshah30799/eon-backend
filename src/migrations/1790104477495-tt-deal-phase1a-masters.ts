import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * TT Deal Cover Rate Phase 1a masters (DB1).
 * - Renames product_card_issuers → product_issuers (preserves rows).
 * - Adds purpose_subpurposes.
 *
 * Unrelated schema drift found during generate (party_profiles.branch_id,
 * purpose_groups/slabs enum rewrite) was excluded from this migration.
 */
export class TtDealPhase1aMasters1790104477495 implements MigrationInterface {
  name = "TtDealPhase1aMasters1790104477495";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasOldTable = await queryRunner.hasTable("product_card_issuers");
    const hasNewTable = await queryRunner.hasTable("product_issuers");

    if (hasOldTable && !hasNewTable) {
      await queryRunner.query(
        `ALTER TABLE "product_card_issuers" RENAME TO "product_issuers"`,
      );
      await queryRunner.query(
        `ALTER INDEX IF EXISTS "IDX_product_card_issuers_product_id" RENAME TO "IDX_product_issuers_product_id"`,
      );
      await queryRunner.query(
        `ALTER INDEX IF EXISTS "IDX_product_card_issuers_party_profile_id" RENAME TO "IDX_product_issuers_party_profile_id"`,
      );
      await queryRunner.query(
        `ALTER TABLE "product_issuers" RENAME CONSTRAINT "UQ_product_card_issuers_product_party_profile" TO "UQ_product_issuers_product_party_profile"`,
      );
    } else if (!hasNewTable) {
      await queryRunner.query(
        `CREATE TABLE "product_issuers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "product_id" uuid NOT NULL, "party_profile_id" uuid NOT NULL, CONSTRAINT "UQ_product_issuers_product_party_profile" UNIQUE ("product_id", "party_profile_id"), CONSTRAINT "PK_product_issuers" PRIMARY KEY ("id"))`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_product_issuers_party_profile_id" ON "product_issuers" ("party_profile_id") `,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_product_issuers_product_id" ON "product_issuers" ("product_id") `,
      );
      await queryRunner.query(
        `ALTER TABLE "product_issuers" ADD CONSTRAINT "FK_product_issuers_product_id" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
      );
      await queryRunner.query(
        `ALTER TABLE "product_issuers" ADD CONSTRAINT "FK_product_issuers_party_profile_id" FOREIGN KEY ("party_profile_id") REFERENCES "party_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
      );
    }

    await queryRunner.query(
      `CREATE TABLE "purpose_subpurposes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "purpose_id" uuid NOT NULL, "code" citext NOT NULL, "name" citext NOT NULL, "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "UQ_purpose_subpurposes_purpose_id_code" UNIQUE ("purpose_id", "code"), CONSTRAINT "PK_purpose_subpurposes" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_purpose_subpurposes_purpose_id" ON "purpose_subpurposes" ("purpose_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "purpose_subpurposes" ADD CONSTRAINT "FK_purpose_subpurposes_purpose_id" FOREIGN KEY ("purpose_id") REFERENCES "purposes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "purpose_subpurposes" DROP CONSTRAINT "FK_purpose_subpurposes_purpose_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_purpose_subpurposes_purpose_id"`,
    );
    await queryRunner.query(`DROP TABLE "purpose_subpurposes"`);

    const hasNewTable = await queryRunner.hasTable("product_issuers");
    const hasOldTable = await queryRunner.hasTable("product_card_issuers");
    if (hasNewTable && !hasOldTable) {
      await queryRunner.query(
        `ALTER TABLE "product_issuers" RENAME TO "product_card_issuers"`,
      );
      await queryRunner.query(
        `ALTER INDEX IF EXISTS "IDX_product_issuers_product_id" RENAME TO "IDX_product_card_issuers_product_id"`,
      );
      await queryRunner.query(
        `ALTER INDEX IF EXISTS "IDX_product_issuers_party_profile_id" RENAME TO "IDX_product_card_issuers_party_profile_id"`,
      );
      await queryRunner.query(
        `ALTER TABLE "product_card_issuers" RENAME CONSTRAINT "UQ_product_issuers_product_party_profile" TO "UQ_product_card_issuers_product_party_profile"`,
      );
    }
  }
}
