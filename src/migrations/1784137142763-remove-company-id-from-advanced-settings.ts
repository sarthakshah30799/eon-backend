import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveCompanyIdFromAdvancedSettings1784137142763 implements MigrationInterface {
    name = 'RemoveCompanyIdFromAdvancedSettings1784137142763'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "advanced_settings" DROP CONSTRAINT "FK_ed84ae6aa6e6e9dca2d183e975d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cdb400011881fefd2ab4309960"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1ee74dea7da6f310a0307f8783"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0e1589fade362de11ac8590f36"`);
        await queryRunner.query(`ALTER TABLE "advanced_settings" DROP COLUMN "company_id"`);
        await queryRunner.query(`CREATE INDEX "IDX_50ddcb943c265824847c769e3b" ON "advanced_settings" ("node_type", "is_active") `);
        await queryRunner.query(`CREATE INDEX "IDX_0481791545b5d714235fc91f73" ON "advanced_settings" ("parent_id", "sort_order") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4ddfdcd7fd22abb9e8ee89522d" ON "advanced_settings" ("code") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_4ddfdcd7fd22abb9e8ee89522d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0481791545b5d714235fc91f73"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_50ddcb943c265824847c769e3b"`);
        await queryRunner.query(`ALTER TABLE "advanced_settings" ADD "company_id" uuid NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0e1589fade362de11ac8590f36" ON "advanced_settings" ("code", "company_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_1ee74dea7da6f310a0307f8783" ON "advanced_settings" ("company_id", "parent_id", "sort_order") `);
        await queryRunner.query(`CREATE INDEX "IDX_cdb400011881fefd2ab4309960" ON "advanced_settings" ("company_id", "is_active", "node_type") `);
        await queryRunner.query(`ALTER TABLE "advanced_settings" ADD CONSTRAINT "FK_ed84ae6aa6e6e9dca2d183e975d" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

}
