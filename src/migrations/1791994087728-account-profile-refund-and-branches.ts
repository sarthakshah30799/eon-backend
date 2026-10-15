import { MigrationInterface, QueryRunner } from "typeorm";

export class AccountProfileRefundAndBranches1791994087728 implements MigrationInterface {
    name = 'AccountProfileRefundAndBranches1791994087728'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "product_issuers" DROP CONSTRAINT "FK_434d752b618066647aa8e587372"`);
        await queryRunner.query(`ALTER TABLE "product_issuers" DROP CONSTRAINT "FK_6bbdc3929722dd6d841e6e4535d"`);
        await queryRunner.query(`CREATE TABLE "account_profile_branches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "account_profile_id" uuid NOT NULL, "branch_id" uuid NOT NULL, CONSTRAINT "UQ_account_profile_branches_account_profile_branch" UNIQUE ("account_profile_id", "branch_id"), CONSTRAINT "PK_8febecd460886f5d4797630675c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_account_profile_branches_branch_id" ON "account_profile_branches" ("branch_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_account_profile_branches_account_profile_id" ON "account_profile_branches" ("account_profile_id") `);
        await queryRunner.query(`ALTER TABLE "account_profiles" ADD "visible_during_refund" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "account_profiles" ADD "refund_limit" numeric(18,2)`);
        await queryRunner.query(`ALTER TABLE "account_profile_branches" ADD CONSTRAINT "FK_cd4ace9b4f8e283ac4d8244fb42" FOREIGN KEY ("account_profile_id") REFERENCES "account_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "account_profile_branches" ADD CONSTRAINT "FK_2e86ead74cbbd1a523fbdf9bc97" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_issuers" ADD CONSTRAINT "FK_82adb99730688985506921c3d08" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_issuers" ADD CONSTRAINT "FK_5767b91e47ccd1249fb65c88c50" FOREIGN KEY ("party_profile_id") REFERENCES "party_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "product_issuers" DROP CONSTRAINT "FK_5767b91e47ccd1249fb65c88c50"`);
        await queryRunner.query(`ALTER TABLE "product_issuers" DROP CONSTRAINT "FK_82adb99730688985506921c3d08"`);
        await queryRunner.query(`ALTER TABLE "account_profile_branches" DROP CONSTRAINT "FK_2e86ead74cbbd1a523fbdf9bc97"`);
        await queryRunner.query(`ALTER TABLE "account_profile_branches" DROP CONSTRAINT "FK_cd4ace9b4f8e283ac4d8244fb42"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" DROP COLUMN "refund_limit"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" DROP COLUMN "visible_during_refund"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_account_profile_branches_account_profile_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_account_profile_branches_branch_id"`);
        await queryRunner.query(`DROP TABLE "account_profile_branches"`);
        await queryRunner.query(`ALTER TABLE "product_issuers" ADD CONSTRAINT "FK_6bbdc3929722dd6d841e6e4535d" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_issuers" ADD CONSTRAINT "FK_434d752b618066647aa8e587372" FOREIGN KEY ("party_profile_id") REFERENCES "party_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
