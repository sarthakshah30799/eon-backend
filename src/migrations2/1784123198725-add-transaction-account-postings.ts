import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTransactionAccountPostings1784123198725
  implements MigrationInterface
{
  name = "AddTransactionAccountPostings1784123198725";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."transaction_account_postings_direction_enum" AS ENUM('DEBIT', 'CREDIT')`,
    );
    await queryRunner.query(`
      CREATE TABLE "transaction_account_postings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "created_by" uuid NOT NULL,
        "updated_by" uuid NOT NULL,
        "transaction_id" uuid NOT NULL,
        "line_no" integer NOT NULL,
        "source_type" character varying(50) NOT NULL,
        "source_id" uuid,
        "account_id" uuid NOT NULL,
        "account_snapshot" jsonb,
        "profile_id" uuid,
        "debit_credit" "public"."transaction_account_postings_direction_enum" NOT NULL,
        "amount" numeric(18,2) NOT NULL,
        "remarks" text,
        CONSTRAINT "PK_807de7524fc9f03c487e6dbaef2" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_transaction_account_postings_profile_id" ON "transaction_account_postings" ("profile_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transaction_account_postings_account_id" ON "transaction_account_postings" ("account_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_transaction_account_postings_transaction_line" ON "transaction_account_postings" ("transaction_id", "line_no") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transaction_account_postings_transaction_id" ON "transaction_account_postings" ("transaction_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_items" ADD "account_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_items" ADD "account_snapshot" jsonb`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transaction_items_account_id" ON "transaction_items" ("account_id") `,
    );
    await queryRunner.query(`
      ALTER TABLE "transaction_account_postings"
      ADD CONSTRAINT "FK_transaction_account_postings_transaction_id"
      FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transaction_account_postings" DROP CONSTRAINT "FK_transaction_account_postings_transaction_id"`,
    );
    await queryRunner.query(`ALTER TABLE "transaction_account_postings" DROP COLUMN "source_id"`);
    await queryRunner.query(`ALTER TABLE "transaction_account_postings" DROP COLUMN "source_type"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_transaction_items_account_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_items" DROP COLUMN "account_snapshot"`,
    );
    await queryRunner.query(`ALTER TABLE "transaction_items" DROP COLUMN "account_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_transaction_account_postings_transaction_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_transaction_account_postings_transaction_line"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_transaction_account_postings_account_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_transaction_account_postings_profile_id"`,
    );
    await queryRunner.query(
      `DROP TABLE "transaction_account_postings"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."transaction_account_postings_direction_enum"`,
    );
  }
}
