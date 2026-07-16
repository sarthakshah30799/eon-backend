import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCounterToTransactions1784181457772 implements MigrationInterface {
  name = "AddCounterToTransactions1784181457772";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "transactions" ADD "counter_id" uuid`);
    await queryRunner.query(`ALTER TABLE "transactions" ADD "counter_snapshot" jsonb`);
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_counter_id" ON "transactions" ("counter_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_transactions_counter_id"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "counter_snapshot"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "counter_id"`);
  }
}
