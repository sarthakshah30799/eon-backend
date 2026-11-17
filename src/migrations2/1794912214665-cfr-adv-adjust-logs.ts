import { MigrationInterface, QueryRunner } from "typeorm";

export class CfrAdvAdjustLogs1794912214665 implements MigrationInterface {
    name = 'CfrAdvAdjustLogs1794912214665'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."credit_request_fund_logs_action_enum" AS ENUM('CREATE', 'APPROVE', 'REJECT', 'CANCEL', 'PRINT')`);
        await queryRunner.query(`CREATE TABLE "credit_request_fund_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "credit_request_fund_id" uuid NOT NULL, "action" "public"."credit_request_fund_logs_action_enum" NOT NULL, "message" text NOT NULL, "before_snapshot" jsonb, "after_snapshot" jsonb, "metadata" jsonb, "performed_by_id" uuid, "performed_by_name" citext, "performed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5f017df4d6873b2a116c2bcdb68" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_credit_request_fund_logs_header_id" ON "credit_request_fund_logs" ("credit_request_fund_id") `);
        await queryRunner.query(`CREATE TYPE "public"."advance_refund_logs_action_enum" AS ENUM('CREATE', 'HONOUR', 'PRINT')`);
        await queryRunner.query(`CREATE TABLE "advance_refund_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "advance_refund_id" uuid NOT NULL, "action" "public"."advance_refund_logs_action_enum" NOT NULL, "message" text NOT NULL, "before_snapshot" jsonb, "after_snapshot" jsonb, "metadata" jsonb, "performed_by_id" uuid, "performed_by_name" citext, "performed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ac0f6753be303cb6d7dc3a5aa2d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_advance_refund_logs_header_id" ON "advance_refund_logs" ("advance_refund_id") `);
        await queryRunner.query(`CREATE TYPE "public"."advance_adjustment_logs_action_enum" AS ENUM('CREATE', 'UPDATE', 'PRINT')`);
        await queryRunner.query(`CREATE TABLE "advance_adjustment_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "advance_adjustment_id" uuid NOT NULL, "action" "public"."advance_adjustment_logs_action_enum" NOT NULL, "message" text NOT NULL, "before_snapshot" jsonb, "after_snapshot" jsonb, "metadata" jsonb, "performed_by_id" uuid, "performed_by_name" citext, "performed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f4f2778e49f06fd013fa53957a7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_advance_adjustment_logs_header_id" ON "advance_adjustment_logs" ("advance_adjustment_id") `);
        await queryRunner.query(`ALTER TABLE "accounting_voucher_logs" ADD "performed_by_name" citext`);
        await queryRunner.query(`ALTER TABLE "advance_adjustment" ADD "receipt_voucher_id" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "advance_adjustment" ADD "receipt_voucher_snapshot" jsonb`);
        await queryRunner.query(`ALTER TABLE "advance_adjustment" ADD "journal_voucher_id" uuid NOT NULL`);
        await queryRunner.query(`ALTER TYPE "public"."deal_covers_status_enum" RENAME TO "deal_covers_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."deal_covers_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" TYPE "public"."deal_covers_status_enum" USING "status"::"text"::"public"."deal_covers_status_enum"`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."deal_covers_status_enum_old"`);
        await queryRunner.query(`CREATE INDEX "IDX_advance_adjustment_journal_voucher_id" ON "advance_adjustment" ("journal_voucher_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_advance_adjustment_receipt_voucher_id" ON "advance_adjustment" ("receipt_voucher_id") `);
        await queryRunner.query(`ALTER TABLE "credit_request_fund_logs" ADD CONSTRAINT "FK_credit_request_fund_logs_header" FOREIGN KEY ("credit_request_fund_id") REFERENCES "credit_request_funds"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "advance_refund_logs" ADD CONSTRAINT "FK_advance_refund_logs_header" FOREIGN KEY ("advance_refund_id") REFERENCES "advance_refund"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "advance_adjustment_logs" ADD CONSTRAINT "FK_advance_adjustment_logs_header" FOREIGN KEY ("advance_adjustment_id") REFERENCES "advance_adjustment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "advance_adjustment_logs" DROP CONSTRAINT "FK_advance_adjustment_logs_header"`);
        await queryRunner.query(`ALTER TABLE "advance_refund_logs" DROP CONSTRAINT "FK_advance_refund_logs_header"`);
        await queryRunner.query(`ALTER TABLE "credit_request_fund_logs" DROP CONSTRAINT "FK_credit_request_fund_logs_header"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_advance_adjustment_receipt_voucher_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_advance_adjustment_journal_voucher_id"`);
        await queryRunner.query(`CREATE TYPE "public"."deal_covers_status_enum_old" AS ENUM('APPROVED', 'CANCELLED', 'PENDING', 'REJECTED')`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" TYPE "public"."deal_covers_status_enum_old" USING "status"::"text"::"public"."deal_covers_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "deal_covers" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`DROP TYPE "public"."deal_covers_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."deal_covers_status_enum_old" RENAME TO "deal_covers_status_enum"`);
        await queryRunner.query(`ALTER TABLE "advance_adjustment" DROP COLUMN "journal_voucher_id"`);
        await queryRunner.query(`ALTER TABLE "advance_adjustment" DROP COLUMN "receipt_voucher_snapshot"`);
        await queryRunner.query(`ALTER TABLE "advance_adjustment" DROP COLUMN "receipt_voucher_id"`);
        await queryRunner.query(`ALTER TABLE "accounting_voucher_logs" DROP COLUMN "performed_by_name"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_advance_adjustment_logs_header_id"`);
        await queryRunner.query(`DROP TABLE "advance_adjustment_logs"`);
        await queryRunner.query(`DROP TYPE "public"."advance_adjustment_logs_action_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_advance_refund_logs_header_id"`);
        await queryRunner.query(`DROP TABLE "advance_refund_logs"`);
        await queryRunner.query(`DROP TYPE "public"."advance_refund_logs_action_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_credit_request_fund_logs_header_id"`);
        await queryRunner.query(`DROP TABLE "credit_request_fund_logs"`);
        await queryRunner.query(`DROP TYPE "public"."credit_request_fund_logs_action_enum"`);
    }

}
