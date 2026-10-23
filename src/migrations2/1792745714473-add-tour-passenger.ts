import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTourPassenger1792745714473 implements MigrationInterface {
    name = 'AddTourPassenger1792745714473'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "tour_passengers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "transaction_id" uuid NOT NULL, "passenger_id" uuid NOT NULL, "line_no" integer NOT NULL, "passport_number" citext, "passport_name" citext, "place_of_issue" citext, "date_of_issue" date, "date_of_expiry" date, "pan_holder_relationship" citext, "traveller_pan_number" citext, "pan_name" citext, "traveller_dob" date, "fcn_code" citext, "fcn_amount" numeric(18,7), "contact_no" text, "remark" text, "other_ad_exchange_date" date, "other_ad_name_address" text, CONSTRAINT "PK_76f7cfd615eed310a315c6da055" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_tour_passengers_transaction_line" ON "tour_passengers" ("transaction_id", "line_no") `);
        await queryRunner.query(`CREATE INDEX "IDX_tour_passengers_passenger_id" ON "tour_passengers" ("passenger_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_tour_passengers_transaction_id" ON "tour_passengers" ("transaction_id") `);
        await queryRunner.query(`ALTER TYPE "public"."deal_covers_status_enum" RENAME TO "deal_covers_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."deal_covers_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" TYPE "public"."deal_covers_status_enum" USING "status"::"text"::"public"."deal_covers_status_enum"`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."deal_covers_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "tour_passengers" ADD CONSTRAINT "FK_tour_passengers_transaction_id" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tour_passengers" DROP CONSTRAINT "FK_tour_passengers_transaction_id"`);
        await queryRunner.query(`CREATE TYPE "public"."deal_covers_status_enum_old" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" TYPE "public"."deal_covers_status_enum_old" USING "status"::"text"::"public"."deal_covers_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."deal_covers_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."deal_covers_status_enum_old" RENAME TO "deal_covers_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tour_passengers_transaction_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tour_passengers_passenger_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tour_passengers_transaction_line"`);
        await queryRunner.query(`DROP TABLE "tour_passengers"`);
    }

}
