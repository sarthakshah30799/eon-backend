import { MigrationInterface, QueryRunner } from "typeorm";

export class AdvanceAdjustment1793251184781 implements MigrationInterface {
    name = 'AdvanceAdjustment1793251184781'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "advance_adjustment_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "advance_adjustment_id" uuid NOT NULL, "line_no" integer NOT NULL, "transaction_id" uuid NOT NULL, "transaction_snapshot" jsonb NOT NULL, "final_amount" numeric(18,2) NOT NULL, "outstanding_amount" numeric(18,2) NOT NULL, "adjustment_amount" numeric(18,2) NOT NULL, CONSTRAINT "CHK_advance_adjustment_item_amount_positive" CHECK ("adjustment_amount" > 0), CONSTRAINT "PK_48b4a90dc17ffcefe27b1f0da03" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_advance_adjustment_items_header_transaction" ON "advance_adjustment_items" ("advance_adjustment_id", "transaction_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_advance_adjustment_items_transaction_id" ON "advance_adjustment_items" ("transaction_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_advance_adjustment_items_header_id" ON "advance_adjustment_items" ("advance_adjustment_id") `);
        await queryRunner.query(`CREATE TYPE "public"."advance_adjustment_status_enum" AS ENUM('DRAFT', 'COMPLETED', 'CANCELLED')`);
        await queryRunner.query(`CREATE TABLE "advance_adjustment" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "number" citext NOT NULL, "branch_id" uuid NOT NULL, "branch_snapshot" jsonb NOT NULL, "counter_id" uuid NOT NULL, "counter_snapshot" jsonb NOT NULL, "transaction_date" date NOT NULL, "as_on_date" date NOT NULL, "party_profile_id" uuid NOT NULL, "party_profile_snapshot" jsonb NOT NULL, "pan_number" citext, "pan_name" citext, "pan_dob" date, "status" "public"."advance_adjustment_status_enum" NOT NULL DEFAULT 'DRAFT', "total_adjustment_amount" numeric(18,2) NOT NULL, "narration" text NOT NULL, CONSTRAINT "PK_3cc9c44d3c2acb9f458279dea0f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_advance_adjustment_status" ON "advance_adjustment" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_advance_adjustment_party" ON "advance_adjustment" ("party_profile_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_advance_adjustment_branch_date" ON "advance_adjustment" ("branch_id", "transaction_date") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_advance_adjustment_number" ON "advance_adjustment" ("number") `);
        await queryRunner.query(`ALTER TYPE "public"."deal_covers_status_enum" RENAME TO "deal_covers_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."deal_covers_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" TYPE "public"."deal_covers_status_enum" USING "status"::"text"::"public"."deal_covers_status_enum"`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."deal_covers_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "advance_adjustment_items" ADD CONSTRAINT "FK_advance_adjustment_items_header" FOREIGN KEY ("advance_adjustment_id") REFERENCES "advance_adjustment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "advance_adjustment_items" DROP CONSTRAINT "FK_advance_adjustment_items_header"`);
        await queryRunner.query(`CREATE TYPE "public"."deal_covers_status_enum_old" AS ENUM('APPROVED', 'CANCELLED', 'PENDING', 'REJECTED')`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" TYPE "public"."deal_covers_status_enum_old" USING "status"::"text"::"public"."deal_covers_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."deal_covers_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."deal_covers_status_enum_old" RENAME TO "deal_covers_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_advance_adjustment_number"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_advance_adjustment_branch_date"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_advance_adjustment_party"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_advance_adjustment_status"`);
        await queryRunner.query(`DROP TABLE "advance_adjustment"`);
        await queryRunner.query(`DROP TYPE "public"."advance_adjustment_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_advance_adjustment_items_header_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_advance_adjustment_items_transaction_id"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_advance_adjustment_items_header_transaction"`);
        await queryRunner.query(`DROP TABLE "advance_adjustment_items"`);
    }

}
