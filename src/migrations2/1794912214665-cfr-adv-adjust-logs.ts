import { MigrationInterface, QueryRunner } from "typeorm";

export class CfrAdvAdjustLogs1794912214665 implements MigrationInterface {
  name = "CfrAdvAdjustLogs1794912214665";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // -------------------------------------------------------------------------
    // Domain log tables
    // -------------------------------------------------------------------------
    await queryRunner.query(
      `CREATE TYPE "public"."credit_request_fund_logs_action_enum" AS ENUM('CREATE', 'APPROVE', 'REJECT', 'CANCEL', 'PRINT')`,
    );
    await queryRunner.query(`
      CREATE TABLE "credit_request_fund_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "created_by" uuid NOT NULL,
        "updated_by" uuid NOT NULL,
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "deleted_by" uuid,
        "credit_request_fund_id" uuid NOT NULL,
        "action" "public"."credit_request_fund_logs_action_enum" NOT NULL,
        "message" text NOT NULL,
        "before_snapshot" jsonb,
        "after_snapshot" jsonb,
        "metadata" jsonb,
        "performed_by_id" uuid,
        "performed_by_name" citext,
        "performed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_5f017df4d6873b2a116c2bcdb68" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_credit_request_fund_logs_header_id" ON "credit_request_fund_logs" ("credit_request_fund_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "credit_request_fund_logs"
      ADD CONSTRAINT "FK_credit_request_fund_logs_header"
      FOREIGN KEY ("credit_request_fund_id")
      REFERENCES "credit_request_funds"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(
      `CREATE TYPE "public"."advance_refund_logs_action_enum" AS ENUM('CREATE', 'HONOUR', 'PRINT')`,
    );
    await queryRunner.query(`
      CREATE TABLE "advance_refund_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "created_by" uuid NOT NULL,
        "updated_by" uuid NOT NULL,
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "deleted_by" uuid,
        "advance_refund_id" uuid NOT NULL,
        "action" "public"."advance_refund_logs_action_enum" NOT NULL,
        "message" text NOT NULL,
        "before_snapshot" jsonb,
        "after_snapshot" jsonb,
        "metadata" jsonb,
        "performed_by_id" uuid,
        "performed_by_name" citext,
        "performed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ac0f6753be303cb6d7dc3a5aa2d" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_advance_refund_logs_header_id" ON "advance_refund_logs" ("advance_refund_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "advance_refund_logs"
      ADD CONSTRAINT "FK_advance_refund_logs_header"
      FOREIGN KEY ("advance_refund_id")
      REFERENCES "advance_refund"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(
      `CREATE TYPE "public"."advance_adjustment_logs_action_enum" AS ENUM('CREATE', 'UPDATE', 'PRINT')`,
    );
    await queryRunner.query(`
      CREATE TABLE "advance_adjustment_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "created_by" uuid NOT NULL,
        "updated_by" uuid NOT NULL,
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        "deleted_by" uuid,
        "advance_adjustment_id" uuid NOT NULL,
        "action" "public"."advance_adjustment_logs_action_enum" NOT NULL,
        "message" text NOT NULL,
        "before_snapshot" jsonb,
        "after_snapshot" jsonb,
        "metadata" jsonb,
        "performed_by_id" uuid,
        "performed_by_name" citext,
        "performed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_f4f2778e49f06fd013fa53957a7" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_advance_adjustment_logs_header_id" ON "advance_adjustment_logs" ("advance_adjustment_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "advance_adjustment_logs"
      ADD CONSTRAINT "FK_advance_adjustment_logs_header"
      FOREIGN KEY ("advance_adjustment_id")
      REFERENCES "advance_adjustment"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // Real entity/DB gap: voucher log writes performedByName but original create omitted the column.
    await queryRunner.query(`
      ALTER TABLE "accounting_voucher_logs"
      ADD COLUMN IF NOT EXISTS "performed_by_name" citext
    `);

    // -------------------------------------------------------------------------
    // Advance adjustment voucher columns (nullable → backfill → NOT NULL)
    // -------------------------------------------------------------------------
    await queryRunner.query(
      `ALTER TABLE "advance_adjustment" ADD COLUMN "receipt_voucher_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "advance_adjustment" ADD COLUMN "receipt_voucher_snapshot" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "advance_adjustment" ADD COLUMN "journal_voucher_id" uuid`,
    );

    await queryRunner.query(`
      DO $$
      DECLARE
        rec RECORD;
        v_receipt RECORD;
        v_receipt_snap jsonb;
        v_jv_id uuid;
        v_missing text;
      BEGIN
        FOR rec IN
          SELECT *
          FROM "advance_adjustment"
          WHERE "receipt_voucher_id" IS NULL
             OR "journal_voucher_id" IS NULL
          ORDER BY "created_at" ASC, "number" ASC
        LOOP
          SELECT av.*
          INTO v_receipt
          FROM "accounting_vouchers" av
          WHERE av."voucher_type" = 'RECEIPT'
            AND av."branch_id" = rec.branch_id
            AND av."party_profile_id" = rec.party_profile_id
            AND av."transaction_date" <= rec.transaction_date
            AND (
              rec.pan_number IS NULL
              OR av."pan_number" IS NULL
              OR av."pan_number" = rec.pan_number
            )
            AND av."final_amount" >= rec.total_adjustment_amount
          ORDER BY
            av."transaction_date" ASC,
            av."number" ASC
          LIMIT 1;

          IF NOT FOUND THEN
            RAISE EXCEPTION
              'No matching advance RECEIPT found to backfill adjustment % (%) branch=% party=% pan=% amount=%',
              rec.id,
              rec.number,
              rec.branch_id,
              rec.party_profile_id,
              rec.pan_number,
              rec.total_adjustment_amount;
          END IF;

          v_receipt_snap := jsonb_build_object(
            'id', v_receipt.id,
            'number', v_receipt.number,
            'finalAmount', v_receipt.final_amount,
            'transactionDate', v_receipt.transaction_date
          );

          SELECT id INTO v_jv_id
          FROM "accounting_vouchers"
          WHERE "idempotency_key" = 'backfill:jv:' || rec.id;

          IF v_jv_id IS NULL THEN
            v_jv_id := uuid_generate_v4();

            INSERT INTO "accounting_vouchers" (
              "id",
              "voucher_type",
              "number",
              "idempotency_key",
              "payload_hash",
              "transaction_date",
              "branch_id",
              "branch_snapshot",
              "counter_id",
              "counter_snapshot",
              "party_profile_id",
              "party_profile_snapshot",
              "pan_number",
              "pan_name",
              "pan_dob",
              "narration",
              "total_debit",
              "total_credit",
              "final_amount",
              "created_by",
              "updated_by"
            ) VALUES (
              v_jv_id,
              'JOURNAL',
              'JV/ADJ/' || rec.number,
              'backfill:jv:' || rec.id,
              'backfill-hash',
              rec.transaction_date,
              rec.branch_id,
              rec.branch_snapshot,
              rec.counter_id,
              rec.counter_snapshot,
              rec.party_profile_id,
              rec.party_profile_snapshot,
              rec.pan_number,
              rec.pan_name,
              rec.pan_dob,
              'Advance Adjustment Backfill JV for ' || rec.number,
              rec.total_adjustment_amount,
              rec.total_adjustment_amount,
              rec.total_adjustment_amount,
              rec.created_by,
              rec.updated_by
            );
          END IF;

          UPDATE "advance_adjustment"
          SET
            "receipt_voucher_id" = v_receipt.id,
            "receipt_voucher_snapshot" = v_receipt_snap,
            "journal_voucher_id" = v_jv_id
          WHERE "id" = rec.id;

          INSERT INTO "advance_adjustment_logs" (
            "id",
            "advance_adjustment_id",
            "action",
            "message",
            "after_snapshot",
            "created_by",
            "updated_by",
            "performed_by_id",
            "performed_at"
          ) VALUES (
            uuid_generate_v4(),
            rec.id,
            'CREATE',
            'Advance adjustment created (migrated)',
            row_to_json(rec)::jsonb,
            rec.created_by,
            rec.updated_by,
            rec.created_by,
            COALESCE(rec.created_at, now())
          );
        END LOOP;

        SELECT string_agg(number::text, ', ' ORDER BY number)
        INTO v_missing
        FROM "advance_adjustment"
        WHERE "receipt_voucher_id" IS NULL
           OR "journal_voucher_id" IS NULL;

        IF v_missing IS NOT NULL THEN
          RAISE EXCEPTION
            'advance_adjustment still missing voucher links after backfill: %',
            v_missing;
        END IF;
      END $$;
    `);

    await queryRunner.query(
      `ALTER TABLE "advance_adjustment" ALTER COLUMN "receipt_voucher_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "advance_adjustment" ALTER COLUMN "journal_voucher_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_advance_adjustment_journal_voucher_id" ON "advance_adjustment" ("journal_voucher_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_advance_adjustment_receipt_voucher_id" ON "advance_adjustment" ("receipt_voucher_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "advance_adjustment"
      ADD CONSTRAINT "FK_advance_adjustment_journal_voucher"
      FOREIGN KEY ("journal_voucher_id")
      REFERENCES "accounting_vouchers"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "advance_adjustment"
      ADD CONSTRAINT "FK_advance_adjustment_receipt_voucher"
      FOREIGN KEY ("receipt_voucher_id")
      REFERENCES "accounting_vouchers"("id")
      ON DELETE RESTRICT ON UPDATE NO ACTION
    `);

    // -------------------------------------------------------------------------
    // Backfill CREATE logs for existing refund / CRF rows
    // -------------------------------------------------------------------------
    await queryRunner.query(`
      INSERT INTO "advance_refund_logs" (
        "id",
        "advance_refund_id",
        "action",
        "message",
        "created_by",
        "updated_by",
        "performed_by_id",
        "performed_at"
      )
      SELECT
        uuid_generate_v4(),
        id,
        'CREATE',
        'Advance refund created (migrated)',
        created_by,
        updated_by,
        created_by,
        COALESCE(created_at, now())
      FROM "advance_refund"
    `);

    await queryRunner.query(`
      INSERT INTO "credit_request_fund_logs" (
        "id",
        "credit_request_fund_id",
        "action",
        "message",
        "created_by",
        "updated_by",
        "performed_by_id",
        "performed_at"
      )
      SELECT
        uuid_generate_v4(),
        id,
        'CREATE',
        'Credit request fund created (migrated)',
        created_by,
        updated_by,
        created_by,
        COALESCE(created_at, now())
      FROM "credit_request_funds"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "advance_adjustment" DROP CONSTRAINT "FK_advance_adjustment_receipt_voucher"`,
    );
    await queryRunner.query(
      `ALTER TABLE "advance_adjustment" DROP CONSTRAINT "FK_advance_adjustment_journal_voucher"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_advance_adjustment_receipt_voucher_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_advance_adjustment_journal_voucher_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "advance_adjustment" DROP COLUMN "journal_voucher_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "advance_adjustment" DROP COLUMN "receipt_voucher_snapshot"`,
    );
    await queryRunner.query(
      `ALTER TABLE "advance_adjustment" DROP COLUMN "receipt_voucher_id"`,
    );

    await queryRunner.query(
      `ALTER TABLE "advance_adjustment_logs" DROP CONSTRAINT "FK_advance_adjustment_logs_header"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_advance_adjustment_logs_header_id"`,
    );
    await queryRunner.query(`DROP TABLE "advance_adjustment_logs"`);
    await queryRunner.query(
      `DROP TYPE "public"."advance_adjustment_logs_action_enum"`,
    );

    await queryRunner.query(
      `ALTER TABLE "advance_refund_logs" DROP CONSTRAINT "FK_advance_refund_logs_header"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_advance_refund_logs_header_id"`,
    );
    await queryRunner.query(`DROP TABLE "advance_refund_logs"`);
    await queryRunner.query(
      `DROP TYPE "public"."advance_refund_logs_action_enum"`,
    );

    await queryRunner.query(
      `ALTER TABLE "credit_request_fund_logs" DROP CONSTRAINT "FK_credit_request_fund_logs_header"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_credit_request_fund_logs_header_id"`,
    );
    await queryRunner.query(`DROP TABLE "credit_request_fund_logs"`);
    await queryRunner.query(
      `DROP TYPE "public"."credit_request_fund_logs_action_enum"`,
    );

    await queryRunner.query(
      `ALTER TABLE "accounting_voucher_logs" DROP COLUMN IF EXISTS "performed_by_name"`,
    );
  }
}
