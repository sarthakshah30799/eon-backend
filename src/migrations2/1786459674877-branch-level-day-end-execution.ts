import { MigrationInterface, QueryRunner } from "typeorm";

export class BranchLevelDayEndExecution1786459674877 implements MigrationInterface {
    name = 'BranchLevelDayEndExecution1786459674877'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_day_end_executions_branch_counter_business_date"`);
        await queryRunner.query(`ALTER TABLE "day_end_executions" DROP COLUMN "counter_id"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_day_end_executions_branch_business_date" ON "day_end_executions" ("branch_id", "business_date") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_day_end_executions_branch_business_date"`);
        await queryRunner.query(`ALTER TABLE "day_end_executions" ADD "counter_id" uuid NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_day_end_executions_branch_counter_business_date" ON "day_end_executions" ("branch_id", "business_date", "counter_id") `);
    }

}
