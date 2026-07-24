import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTransactionTcsSchemaGenerated1784909098035 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'purpose_rate_type_enum'
        ) THEN
          CREATE TYPE "public"."purpose_rate_type_enum" AS ENUM ('PERCENT', 'RUPEES');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "transactions"
        ADD COLUMN IF NOT EXISTS "passenger_travel_id" uuid,
        ADD COLUMN IF NOT EXISTS "passenger_travel_snapshot" jsonb,
        ADD COLUMN IF NOT EXISTS "pre_tcs_final_amount" numeric(18,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "tcs_rate_percent" numeric(18,4) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "tcs_rate_type" "public"."purpose_rate_type_enum",
        ADD COLUMN IF NOT EXISTS "tcs_amount" numeric(18,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "loan_amount" numeric(18,2),
        ADD COLUMN IF NOT EXISTS "declared_amount" numeric(18,2),
        ADD COLUMN IF NOT EXISTS "itr_filed" boolean,
        ADD COLUMN IF NOT EXISTS "tcs_declaration_accepted" boolean,
        ADD COLUMN IF NOT EXISTS "is_proprietorship" boolean;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_transactions_passenger_travel_id"
      ON "transactions" ("passenger_travel_id");
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "transaction_tcs_breakdowns" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "created_by" uuid NOT NULL,
        "updated_by" uuid NOT NULL,
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "deleted_by" uuid,
        "transaction_id" uuid NOT NULL,
        "line_no" integer NOT NULL,
        "purpose_id" uuid,
        "purpose_slab_id" uuid,
        "base_amount" numeric(18,2) NOT NULL DEFAULT 0,
        "rate_percent" numeric(18,4) NOT NULL DEFAULT 0,
        "rate_type" "public"."purpose_rate_type_enum" NOT NULL DEFAULT 'PERCENT',
        "tcs_amount" numeric(18,2) NOT NULL DEFAULT 0,
        CONSTRAINT "PK_transaction_tcs_breakdowns_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_transaction_tcs_breakdowns_transaction_line"
      ON "transaction_tcs_breakdowns" ("transaction_id", "line_no");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_transaction_tcs_breakdowns_transaction_id"
      ON "transaction_tcs_breakdowns" ("transaction_id");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_transaction_tcs_breakdowns_purpose_id"
      ON "transaction_tcs_breakdowns" ("purpose_id");
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_transaction_tcs_breakdowns_transaction_id'
        ) THEN
          ALTER TABLE "transaction_tcs_breakdowns"
            ADD CONSTRAINT "FK_transaction_tcs_breakdowns_transaction_id"
            FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "transaction_tcs_breakdowns" DROP CONSTRAINT IF EXISTS "FK_transaction_tcs_breakdowns_transaction_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_transaction_tcs_breakdowns_purpose_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_transaction_tcs_breakdowns_transaction_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_transaction_tcs_breakdowns_transaction_line";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "transaction_tcs_breakdowns";`);

    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_transactions_passenger_travel_id";`);
    await queryRunner.query(`
      ALTER TABLE "transactions"
        DROP COLUMN IF EXISTS "is_proprietorship",
        DROP COLUMN IF EXISTS "tcs_declaration_accepted",
        DROP COLUMN IF EXISTS "itr_filed",
        DROP COLUMN IF EXISTS "declared_amount",
        DROP COLUMN IF EXISTS "loan_amount",
        DROP COLUMN IF EXISTS "tcs_amount",
        DROP COLUMN IF EXISTS "tcs_rate_type",
        DROP COLUMN IF EXISTS "tcs_rate_percent",
        DROP COLUMN IF EXISTS "pre_tcs_final_amount",
        DROP COLUMN IF EXISTS "passenger_travel_snapshot",
        DROP COLUMN IF EXISTS "passenger_travel_id";
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'purpose_rate_type_enum'
        ) THEN
          DROP TYPE "public"."purpose_rate_type_enum";
        END IF;
      END
      $$;
    `);
  }
}
