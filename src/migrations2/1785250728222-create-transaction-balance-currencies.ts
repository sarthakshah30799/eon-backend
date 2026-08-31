import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTransactionBalanceCurrencies1785250728222 implements MigrationInterface {
  name = "CreateTransactionBalanceCurrencies1785250728222";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "transaction_balance_currencies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "date" TIMESTAMP WITH TIME ZONE NOT NULL, "branch_id" uuid NOT NULL, "branchsnapshot" jsonb, "counter_id" uuid NOT NULL, "countersnapshot" jsonb, "currency_id" uuid NOT NULL, "currencysnapshot" jsonb, "profiletype" citext NOT NULL, "opening" numeric(18,7) NOT NULL DEFAULT '0', "openingrs" numeric(18,2) NOT NULL DEFAULT '0', "purchase" numeric(18,7) NOT NULL DEFAULT '0', "purchasers" numeric(18,2) NOT NULL DEFAULT '0', "sell" numeric(18,7) NOT NULL DEFAULT '0', "sellrs" numeric(18,2) NOT NULL DEFAULT '0', "adjustsellrs" numeric(18,2) NOT NULL DEFAULT '0', "closing" numeric(18,7) NOT NULL DEFAULT '0', "closingrs" numeric(18,2) NOT NULL DEFAULT '0', CONSTRAINT "PK_80a629e4384329537a226f494f0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transaction_balance_currencies_currency_id" ON "transaction_balance_currencies" ("currency_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transaction_balance_currencies_branch_counter_date" ON "transaction_balance_currencies" ("branch_id", "counter_id", "date") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_transaction_balance_currencies_bucket" ON "transaction_balance_currencies" ("date", "branch_id", "counter_id", "currency_id", "profiletype") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_transaction_balance_currencies_bucket"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_transaction_balance_currencies_branch_counter_date"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_transaction_balance_currencies_currency_id"`,
    );
    await queryRunner.query(`DROP TABLE "transaction_balance_currencies"`);
  }
}
