import { MigrationInterface, QueryRunner } from "typeorm";

export class PartyProfilesBranchidRename1783459801714 implements MigrationInterface {
    name = 'PartyProfilesBranchidRename1783459801714'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP CONSTRAINT "FK_party_profiles_origin_branch_id"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" RENAME COLUMN "origin_branch_id" TO "branch_id"`);
        await queryRunner.query(`CREATE INDEX "IDX_party_profiles_branch_id" ON "party_profiles" ("branch_id") `);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD CONSTRAINT "FK_party_profiles_branch_id" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP CONSTRAINT "FK_party_profiles_branch_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_party_profiles_branch_id"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" RENAME COLUMN "branch_id" TO "origin_branch_id"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD CONSTRAINT "FK_party_profiles_origin_branch_id" FOREIGN KEY ("origin_branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

}
