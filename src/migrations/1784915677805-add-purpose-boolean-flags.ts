import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPurposeBooleanFlags1784915677805 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "purposes"
        ADD COLUMN IF NOT EXISTS "corporate" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "individual" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "sell" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "purchase" boolean NOT NULL DEFAULT false;
    `);

    await queryRunner.query(`
      UPDATE "purposes"
      SET
        "corporate" = CASE
          WHEN "party_profile_type" IS NULL THEN true
          WHEN UPPER("party_profile_type"::text) = 'CORPORATE' THEN true
          ELSE false
        END,
        "individual" = CASE
          WHEN "party_profile_type" IS NULL THEN true
          WHEN UPPER("party_profile_type"::text) = 'INDIVIDUAL' THEN true
          ELSE false
        END,
        "sell" = CASE
          WHEN UPPER("transaction_type"::text) = 'SALE' THEN true
          ELSE false
        END,
        "purchase" = CASE
          WHEN UPPER("transaction_type"::text) = 'PURCHASE' THEN true
          ELSE false
        END;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_purposes_corporate" ON "purposes" ("corporate");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_purposes_individual" ON "purposes" ("individual");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_purposes_sell" ON "purposes" ("sell");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_purposes_purchase" ON "purposes" ("purchase");
    `);

    await queryRunner.query(`
      ALTER TABLE "purposes"
        DROP CONSTRAINT IF EXISTS "CHK_purposes_scope_flags";
    `);
    await queryRunner.query(`
      ALTER TABLE "purposes"
        ADD CONSTRAINT "CHK_purposes_scope_flags"
        CHECK (("corporate" OR "individual") AND ("sell" OR "purchase"));
    `);

    await queryRunner.query(`
      ALTER TABLE "purposes"
        DROP COLUMN IF EXISTS "party_profile_type",
        DROP COLUMN IF EXISTS "transaction_type";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "public"."IDX_purposes_transaction_type_party_profile_type";
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "public"."IDX_purposes_transaction_type";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "purposes"
        ADD COLUMN IF NOT EXISTS "transaction_type" "public"."transactions_transaction_type_enum",
        ADD COLUMN IF NOT EXISTS "party_profile_type" "public"."purpose_party_profile_type_enum";
    `);

    await queryRunner.query(`
      UPDATE "purposes"
      SET
        "transaction_type" = CASE
          WHEN "purchase" THEN 'PURCHASE'
          ELSE 'SALE'
        END,
        "party_profile_type" = CASE
          WHEN "corporate" AND NOT "individual" THEN 'CORPORATE'
          WHEN "individual" AND NOT "corporate" THEN 'INDIVIDUAL'
          WHEN "corporate" THEN 'CORPORATE'
          ELSE 'INDIVIDUAL'
        END;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_purposes_transaction_type" ON "purposes" ("transaction_type");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_purposes_transaction_type_party_profile_type"
      ON "purposes" ("transaction_type", "party_profile_type");
    `);

    await queryRunner.query(`
      ALTER TABLE "purposes"
        DROP CONSTRAINT IF EXISTS "CHK_purposes_scope_flags";
    `);
    await queryRunner.query(`
      ALTER TABLE "purposes"
        DROP COLUMN IF EXISTS "purchase",
        DROP COLUMN IF EXISTS "sell",
        DROP COLUMN IF EXISTS "individual",
        DROP COLUMN IF EXISTS "corporate";
    `);
  }

}
