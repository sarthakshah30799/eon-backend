import { MigrationInterface, QueryRunner } from "typeorm";

export class DayEndExecutionCounter1786384996988 implements MigrationInterface {
  name = "DayEndExecutionCounter1786384996988";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_day_end_executions_branch_user_business_date"`,
    );
    await queryRunner.query(
      `ALTER TABLE "day_end_executions" ADD "counter_id" uuid`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_day_end_executions_branch_counter_business_date" ON "day_end_executions" ("branch_id", "counter_id", "business_date") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_day_end_executions_branch_counter_business_date"`,
    );
    await queryRunner.query(
      `ALTER TABLE "day_end_executions" DROP COLUMN "counter_id"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_day_end_executions_branch_user_business_date" ON "day_end_executions" ("branch_id", "business_date", "user_id") `,
    );
  }
}
