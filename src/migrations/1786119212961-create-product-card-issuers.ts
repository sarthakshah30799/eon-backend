import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateProductCardIssuers1786119212961 implements MigrationInterface {
    name = 'CreateProductCardIssuers1786119212961'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "product_card_issuers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "product_id" uuid NOT NULL, "party_profile_id" uuid NOT NULL, CONSTRAINT "UQ_product_card_issuers_product_party_profile" UNIQUE ("product_id", "party_profile_id"), CONSTRAINT "PK_d9312cdb046089dc839860da875" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_product_card_issuers_party_profile_id" ON "product_card_issuers" ("party_profile_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_product_card_issuers_product_id" ON "product_card_issuers" ("product_id") `);
        await queryRunner.query(`ALTER TABLE "product_card_issuers" ADD CONSTRAINT "FK_6bbdc3929722dd6d841e6e4535d" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_card_issuers" ADD CONSTRAINT "FK_434d752b618066647aa8e587372" FOREIGN KEY ("party_profile_id") REFERENCES "party_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "product_card_issuers" DROP CONSTRAINT "FK_434d752b618066647aa8e587372"`);
        await queryRunner.query(`ALTER TABLE "product_card_issuers" DROP CONSTRAINT "FK_6bbdc3929722dd6d841e6e4535d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_product_card_issuers_product_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_product_card_issuers_party_profile_id"`);
        await queryRunner.query(`DROP TABLE "product_card_issuers"`);
    }

}
