import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeDayEndCounterNotNullable1786390496003 implements MigrationInterface {
    name = 'MakeDayEndCounterNotNullable1786390496003'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_day_end_executions_branch_counter_business_date"`);
        await queryRunner.query(`ALTER TABLE "day_end_executions" ALTER COLUMN "counter_id" SET NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_day_end_executions_branch_counter_business_date" ON "day_end_executions" ("branch_id", "counter_id", "business_date") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_day_end_executions_branch_counter_business_date"`);
        await queryRunner.query(`ALTER TABLE "day_end_executions" ALTER COLUMN "counter_id" DROP NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_day_end_executions_branch_counter_business_date" ON "day_end_executions" ("branch_id", "business_date", "counter_id") `);
    }

}
