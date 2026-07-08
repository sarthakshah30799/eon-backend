import { MigrationInterface, QueryRunner } from "typeorm";

export class FailedPasswordAttempt1781781332738 implements MigrationInterface {
    name = 'FailedPasswordAttempt1781781332738'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "countries" DROP CONSTRAINT "FK_countries_country_group_id"`);
        await queryRunner.query(`ALTER TABLE "corporate_clients" DROP CONSTRAINT "FK_corporate_clients_origin_branch_id"`);
        await queryRunner.query(`ALTER TABLE "corporate_clients" DROP CONSTRAINT "FK_corporate_clients_gst_state_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_country_groups_name"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_country_groups_code"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_countries_country_group_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_corporate_clients_code"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_corporate_clients_name"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_corporate_clients_gst_state_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_corporate_clients_origin_branch_id"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "failed_password_attempts" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "country_groups" ADD CONSTRAINT "UQ_d9c588f7a5b3a1477944dc5bdec" UNIQUE ("code")`);
        await queryRunner.query(`ALTER TABLE "country_groups" ADD CONSTRAINT "UQ_427b362a95a14b1a4b61fddd235" UNIQUE ("name")`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0ece6ef150343e4987308d300f" ON "corporate_clients" ("code") `);
        await queryRunner.query(`ALTER TABLE "countries" ADD CONSTRAINT "FK_5282e50264b11ceda9ab04bc500" FOREIGN KEY ("country_group_id") REFERENCES "country_groups"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "corporate_clients" ADD CONSTRAINT "FK_0b0e30b37f4fb74c221872d8588" FOREIGN KEY ("gst_state_id") REFERENCES "states"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "corporate_clients" ADD CONSTRAINT "FK_1ca6a8ada551d33f372adfca0f5" FOREIGN KEY ("origin_branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "corporate_clients" DROP CONSTRAINT "FK_1ca6a8ada551d33f372adfca0f5"`);
        await queryRunner.query(`ALTER TABLE "corporate_clients" DROP CONSTRAINT "FK_0b0e30b37f4fb74c221872d8588"`);
        await queryRunner.query(`ALTER TABLE "countries" DROP CONSTRAINT "FK_5282e50264b11ceda9ab04bc500"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0ece6ef150343e4987308d300f"`);
        await queryRunner.query(`ALTER TABLE "country_groups" DROP CONSTRAINT "UQ_427b362a95a14b1a4b61fddd235"`);
        await queryRunner.query(`ALTER TABLE "country_groups" DROP CONSTRAINT "UQ_d9c588f7a5b3a1477944dc5bdec"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "failed_password_attempts"`);
        await queryRunner.query(`CREATE INDEX "IDX_corporate_clients_origin_branch_id" ON "corporate_clients" ("origin_branch_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_corporate_clients_gst_state_id" ON "corporate_clients" ("gst_state_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_corporate_clients_name" ON "corporate_clients" ("name") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_corporate_clients_code" ON "corporate_clients" ("code") `);
        await queryRunner.query(`CREATE INDEX "IDX_countries_country_group_id" ON "countries" ("country_group_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_country_groups_code" ON "country_groups" ("code") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_country_groups_name" ON "country_groups" ("name") `);
        await queryRunner.query(`ALTER TABLE "corporate_clients" ADD CONSTRAINT "FK_corporate_clients_gst_state_id" FOREIGN KEY ("gst_state_id") REFERENCES "states"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "corporate_clients" ADD CONSTRAINT "FK_corporate_clients_origin_branch_id" FOREIGN KEY ("origin_branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "countries" ADD CONSTRAINT "FK_countries_country_group_id" FOREIGN KEY ("country_group_id") REFERENCES "country_groups"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

}
