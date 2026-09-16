import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVoucherAccountPostings1789022140046 implements MigrationInterface {
    name = 'AddVoucherAccountPostings1789022140046'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."voucher_account_postings_source_type_enum" AS ENUM('HEADER', 'ITEM')`);
        await queryRunner.query(`CREATE TYPE "public"."voucher_account_postings_direction_enum" AS ENUM('DEBIT', 'CREDIT')`);
        await queryRunner.query(`CREATE TABLE "voucher_account_postings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "voucher_id" uuid NOT NULL, "line_no" integer NOT NULL, "source_type" "public"."voucher_account_postings_source_type_enum" NOT NULL, "source_id" uuid, "transaction_id" uuid, "transaction_snapshot" jsonb, "account_id" uuid NOT NULL, "account_snapshot" jsonb, "profile_id" uuid, "profile_snapshot" jsonb, "direction" "public"."voucher_account_postings_direction_enum" NOT NULL, "amount" numeric(18,2) NOT NULL, "remarks" text, CONSTRAINT "PK_2df77b0d68121c4aaa0dbf0815a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_voucher_account_postings_transaction_id" ON "voucher_account_postings" ("transaction_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_voucher_account_postings_profile_id" ON "voucher_account_postings" ("profile_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_voucher_account_postings_account_id" ON "voucher_account_postings" ("account_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_voucher_account_postings_voucher_line" ON "voucher_account_postings" ("voucher_id", "line_no") `);
        await queryRunner.query(`CREATE INDEX "IDX_voucher_account_postings_voucher_id" ON "voucher_account_postings" ("voucher_id") `);
        await queryRunner.query(`CREATE TYPE "public"."voucher_events_status_enum" AS ENUM('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED')`);
        await queryRunner.query(`CREATE TABLE "voucher_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "voucher_id" uuid NOT NULL, "event_type" text NOT NULL, "payload" jsonb NOT NULL, "status" "public"."voucher_events_status_enum" NOT NULL DEFAULT 'PENDING', "attempt_count" integer NOT NULL DEFAULT '0', "available_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "processed_at" TIMESTAMP WITH TIME ZONE, "error_message" text, "locked_at" TIMESTAMP WITH TIME ZONE, "locked_by_id" uuid, CONSTRAINT "PK_b488c41ea1c68ae558789ca5578" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_voucher_events_status_available_at" ON "voucher_events" ("status", "available_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_voucher_events_voucher_id" ON "voucher_events" ("voucher_id") `);
        await queryRunner.query(`ALTER TABLE "voucher_account_postings" ADD CONSTRAINT "FK_voucher_account_postings_voucher_id" FOREIGN KEY ("voucher_id") REFERENCES "accounting_vouchers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "voucher_events" ADD CONSTRAINT "FK_voucher_events_voucher_id" FOREIGN KEY ("voucher_id") REFERENCES "accounting_vouchers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "voucher_events" DROP CONSTRAINT "FK_voucher_events_voucher_id"`);
        await queryRunner.query(`ALTER TABLE "voucher_account_postings" DROP CONSTRAINT "FK_voucher_account_postings_voucher_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_voucher_events_voucher_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_voucher_events_status_available_at"`);
        await queryRunner.query(`DROP TABLE "voucher_events"`);
        await queryRunner.query(`DROP TYPE "public"."voucher_events_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_voucher_account_postings_voucher_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_voucher_account_postings_voucher_line"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_voucher_account_postings_account_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_voucher_account_postings_profile_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_voucher_account_postings_transaction_id"`);
        await queryRunner.query(`DROP TABLE "voucher_account_postings"`);
        await queryRunner.query(`DROP TYPE "public"."voucher_account_postings_direction_enum"`);
        await queryRunner.query(`DROP TYPE "public"."voucher_account_postings_source_type_enum"`);
    }

}
