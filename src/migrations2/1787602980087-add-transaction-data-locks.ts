import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTransactionDataLocks1787602980087 implements MigrationInterface {
  name = "AddTransactionDataLocks1787602980087";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "transaction_data_locks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "branch_id" uuid NOT NULL, "locked_through_date" date NOT NULL, "locked_at" TIMESTAMP WITH TIME ZONE NOT NULL, "locked_by" uuid NOT NULL, "report_start_date" date, "report_end_date" date, CONSTRAINT "PK_36f9908876e004cea3b6d2c4458" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_transaction_data_locks_branch_id" ON "transaction_data_locks" ("branch_id") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_transaction_data_locks_branch_id"`,
    );
    await queryRunner.query(`DROP TABLE "transaction_data_locks"`);
  }
}
