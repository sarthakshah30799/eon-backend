import { MigrationInterface, QueryRunner } from "typeorm";

export class SaleTcsTravelCountryMasterSchema1784899962504 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1
              FROM pg_type
              WHERE typname = 'purpose_party_profile_type_enum'
            ) THEN
              CREATE TYPE "public"."purpose_party_profile_type_enum" AS ENUM ('CORPORATE', 'INDIVIDUAL');
            END IF;
          END
          $$;
        `);

        await queryRunner.query(`
          ALTER TABLE "purposes"
            ADD COLUMN IF NOT EXISTS "party_profile_type" "public"."purpose_party_profile_type_enum";
        `);

        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS "IDX_purposes_transaction_type_party_profile_type"
          ON "purposes" ("transaction_type", "party_profile_type");
        `);

        await queryRunner.query(`
          ALTER TABLE "country_groups"
            ADD COLUMN IF NOT EXISTS "sell_limit_amount" numeric(18,2),
            ADD COLUMN IF NOT EXISTS "sell_limit_currency_id" uuid,
            ADD COLUMN IF NOT EXISTS "min_travel_days" integer,
            ADD COLUMN IF NOT EXISTS "max_travel_days" integer;
        `);

        await queryRunner.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1
              FROM pg_constraint
              WHERE conname = 'FK_country_groups_sell_limit_currency_id'
            ) THEN
              ALTER TABLE "country_groups"
                ADD CONSTRAINT "FK_country_groups_sell_limit_currency_id"
                FOREIGN KEY ("sell_limit_currency_id") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
            END IF;
          END
          $$;
        `);

        await queryRunner.query(`
          ALTER TABLE "countries"
            ADD COLUMN IF NOT EXISTS "is_cis_country" boolean NOT NULL DEFAULT false;
        `);

        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS "passenger_travels" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
            "created_by" uuid NOT NULL,
            "updated_by" uuid NOT NULL,
            "deleted_at" TIMESTAMP WITH TIME ZONE,
            "deleted_by" uuid,
            "passenger_id" uuid NOT NULL,
            "airline_tt_id" uuid,
            "ticket_no" citext,
            "route" citext,
            "travelling_country_id" uuid,
            "no_of_days" integer,
            "no_of_pax" integer,
            "departure_date" date,
            "travel_pnr" citext,
            "visa" boolean NOT NULL DEFAULT false,
            "is_cis_country" boolean NOT NULL DEFAULT false,
            CONSTRAINT "PK_passenger_travels_id" PRIMARY KEY ("id")
          )
        `);

        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS "IDX_passenger_travels_passenger_id"
          ON "passenger_travels" ("passenger_id")
        `);
        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS "IDX_passenger_travels_country_id"
          ON "passenger_travels" ("travelling_country_id")
        `);
        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS "IDX_passenger_travels_ticket_no"
          ON "passenger_travels" ("ticket_no")
        `);
        await queryRunner.query(`
          CREATE INDEX IF NOT EXISTS "IDX_passenger_travels_travel_pnr"
          ON "passenger_travels" ("travel_pnr")
        `);

        await queryRunner.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1
              FROM pg_constraint
              WHERE conname = 'FK_passenger_travels_passenger_id'
            ) THEN
              ALTER TABLE "passenger_travels"
                ADD CONSTRAINT "FK_passenger_travels_passenger_id"
                FOREIGN KEY ("passenger_id") REFERENCES "passengers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
            END IF;
          END
          $$;
        `);

        await queryRunner.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1
              FROM pg_constraint
              WHERE conname = 'FK_passenger_travels_airline_tt_id'
            ) THEN
              ALTER TABLE "passenger_travels"
                ADD CONSTRAINT "FK_passenger_travels_airline_tt_id"
                FOREIGN KEY ("airline_tt_id") REFERENCES "category_options"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
            END IF;
          END
          $$;
        `);

        await queryRunner.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1
              FROM pg_constraint
              WHERE conname = 'FK_passenger_travels_travelling_country_id'
            ) THEN
              ALTER TABLE "passenger_travels"
                ADD CONSTRAINT "FK_passenger_travels_travelling_country_id"
                FOREIGN KEY ("travelling_country_id") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
            END IF;
          END
          $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
          ALTER TABLE "passenger_travels" DROP CONSTRAINT IF EXISTS "FK_passenger_travels_travelling_country_id";
        `);
        await queryRunner.query(`
          ALTER TABLE "passenger_travels" DROP CONSTRAINT IF EXISTS "FK_passenger_travels_airline_tt_id";
        `);
        await queryRunner.query(`
          ALTER TABLE "passenger_travels" DROP CONSTRAINT IF EXISTS "FK_passenger_travels_passenger_id";
        `);
        await queryRunner.query(`DROP TABLE IF EXISTS "passenger_travels";`);
        await queryRunner.query(`ALTER TABLE "countries" DROP COLUMN IF EXISTS "is_cis_country";`);
        await queryRunner.query(`ALTER TABLE "country_groups" DROP CONSTRAINT IF EXISTS "FK_country_groups_sell_limit_currency_id";`);
        await queryRunner.query(`
          ALTER TABLE "country_groups"
            DROP COLUMN IF EXISTS "max_travel_days",
            DROP COLUMN IF EXISTS "min_travel_days",
            DROP COLUMN IF EXISTS "sell_limit_currency_id",
            DROP COLUMN IF EXISTS "sell_limit_amount";
        `);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_purposes_transaction_type_party_profile_type";`);
        await queryRunner.query(`ALTER TABLE "purposes" DROP COLUMN IF EXISTS "party_profile_type";`);
        await queryRunner.query(`
          DO $$
          BEGIN
            IF EXISTS (
              SELECT 1
              FROM pg_type
              WHERE typname = 'purpose_party_profile_type_enum'
            ) THEN
              DROP TYPE "public"."purpose_party_profile_type_enum";
            END IF;
          END
          $$;
        `);
    }

}
