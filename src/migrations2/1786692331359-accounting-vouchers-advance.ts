import { MigrationInterface, QueryRunner } from "typeorm";

export class AccountingVouchersAdvance1786692331359 implements MigrationInterface {
  name = "AccountingVouchersAdvance1786692331359";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."accounting_voucher_items_direction_enum" AS ENUM('DEBIT', 'CREDIT')`,
    );
    await queryRunner.query(
      `CREATE TABLE "accounting_voucher_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "voucher_id" uuid NOT NULL, "line_no" integer NOT NULL, "item_type_option_id" uuid NOT NULL, "item_type_snapshot" jsonb NOT NULL, "subledger_party_profile_id" uuid, "subledger_party_profile_snapshot" jsonb, "account_id" uuid NOT NULL, "account_snapshot" jsonb NOT NULL, "direction" "public"."accounting_voucher_items_direction_enum" NOT NULL, "amount" numeric(18,2) NOT NULL, CONSTRAINT "CHK_accounting_voucher_items_amount_positive" CHECK ("amount" > 0), CONSTRAINT "PK_0487d3d20104ab592dd2992fb73" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_accounting_voucher_items_line" ON "accounting_voucher_items" ("voucher_id", "line_no") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."accounting_vouchers_voucher_type_enum" AS ENUM('RECEIPT', 'PAYMENT', 'JOURNAL')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."accounting_vouchers_account_mode_enum" AS ENUM('CASH', 'BANK_CHEQUE', 'PETTY_CASH', 'CREDIT_CARD')`,
    );
    await queryRunner.query(
      `CREATE TABLE "accounting_vouchers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "voucher_type" "public"."accounting_vouchers_voucher_type_enum" NOT NULL, "number" citext NOT NULL, "idempotency_key" text NOT NULL, "payload_hash" text NOT NULL, "transaction_date" date NOT NULL, "branch_id" uuid NOT NULL, "branch_snapshot" jsonb NOT NULL, "counter_id" uuid NOT NULL, "counter_snapshot" jsonb NOT NULL, "account_type_option_id" uuid, "account_type_snapshot" jsonb, "account_mode" "public"."accounting_vouchers_account_mode_enum", "header_account_id" uuid, "header_account_snapshot" jsonb, "entity_type_option_id" uuid, "entity_type_snapshot" jsonb, "party_profile_id" uuid, "party_profile_snapshot" jsonb, "pan_number" citext, "cheque_number" citext, "normalized_cheque_number" citext, "cheque_date" date, "cheque_branch" text, "drawn_on" text, "remark_option_id" uuid, "remark_snapshot" jsonb, "narration" text NOT NULL, "total_debit" numeric(18,2) NOT NULL, "total_credit" numeric(18,2) NOT NULL, "final_amount" numeric(18,2) NOT NULL, "advance_control_account_id" uuid, "advance_control_account_snapshot" jsonb, CONSTRAINT "CHK_accounting_vouchers_amounts_nonnegative" CHECK ("total_debit" >= 0 AND "total_credit" >= 0 AND "final_amount" >= 0), CONSTRAINT "PK_56ea1838dad796aa64176f1253c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_accounting_vouchers_cheque" ON "accounting_vouchers" ("voucher_type", "header_account_id", "normalized_cheque_number") WHERE "normalized_cheque_number" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_accounting_vouchers_type_date" ON "accounting_vouchers" ("voucher_type", "transaction_date") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_accounting_vouchers_party_branch_date" ON "accounting_vouchers" ("party_profile_id", "branch_id", "transaction_date") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_accounting_vouchers_idempotency" ON "accounting_vouchers" ("idempotency_key") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_accounting_vouchers_number" ON "accounting_vouchers" ("number") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."voucher_advance_applications_state_enum" AS ENUM('RESERVED', 'APPLIED', 'RELEASED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "voucher_advance_applications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "voucher_id" uuid NOT NULL, "transaction_id" uuid NOT NULL, "transaction_payment_id" uuid NOT NULL, "amount" numeric(18,2) NOT NULL, "state" "public"."voucher_advance_applications_state_enum" NOT NULL, "reserved_at" TIMESTAMP WITH TIME ZONE, "applied_at" TIMESTAMP WITH TIME ZONE, "released_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "REL_0151a39b68e372887afddcd138" UNIQUE ("transaction_payment_id"), CONSTRAINT "CHK_voucher_advance_amount_positive" CHECK ("amount" > 0), CONSTRAINT "PK_a2586597ad4a1e22cf869ce0827" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_voucher_advance_balance" ON "voucher_advance_applications" ("voucher_id", "state") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_voucher_advance_payment" ON "voucher_advance_applications" ("transaction_payment_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_voucher_advance_transaction" ON "voucher_advance_applications" ("voucher_id", "transaction_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transaction_payments_settlement_source_enum" AS ENUM('NORMAL', 'ADVANCE')`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_payments" ADD "settlement_source" "public"."transaction_payments_settlement_source_enum" NOT NULL DEFAULT 'NORMAL'`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_payments" ADD "advance_voucher_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounting_voucher_items" ADD CONSTRAINT "FK_accounting_voucher_items_voucher" FOREIGN KEY ("voucher_id") REFERENCES "accounting_vouchers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "voucher_advance_applications" ADD CONSTRAINT "FK_voucher_advance_applications_voucher" FOREIGN KEY ("voucher_id") REFERENCES "accounting_vouchers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "voucher_advance_applications" ADD CONSTRAINT "FK_voucher_advance_applications_transaction" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "voucher_advance_applications" ADD CONSTRAINT "FK_voucher_advance_applications_payment" FOREIGN KEY ("transaction_payment_id") REFERENCES "transaction_payments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "voucher_advance_applications" DROP CONSTRAINT "FK_voucher_advance_applications_payment"`,
    );
    await queryRunner.query(
      `ALTER TABLE "voucher_advance_applications" DROP CONSTRAINT "FK_voucher_advance_applications_transaction"`,
    );
    await queryRunner.query(
      `ALTER TABLE "voucher_advance_applications" DROP CONSTRAINT "FK_voucher_advance_applications_voucher"`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounting_voucher_items" DROP CONSTRAINT "FK_accounting_voucher_items_voucher"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_payments" DROP COLUMN "advance_voucher_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transaction_payments" DROP COLUMN "settlement_source"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."transaction_payments_settlement_source_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_voucher_advance_transaction"`,
    );
    await queryRunner.query(`DROP INDEX "public"."UQ_voucher_advance_payment"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_voucher_advance_balance"`,
    );
    await queryRunner.query(`DROP TABLE "voucher_advance_applications"`);
    await queryRunner.query(
      `DROP TYPE "public"."voucher_advance_applications_state_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_accounting_vouchers_number"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_accounting_vouchers_idempotency"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_accounting_vouchers_party_branch_date"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_accounting_vouchers_type_date"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_accounting_vouchers_cheque"`,
    );
    await queryRunner.query(`DROP TABLE "accounting_vouchers"`);
    await queryRunner.query(
      `DROP TYPE "public"."accounting_vouchers_account_mode_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."accounting_vouchers_voucher_type_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_accounting_voucher_items_line"`,
    );
    await queryRunner.query(`DROP TABLE "accounting_voucher_items"`);
    await queryRunner.query(
      `DROP TYPE "public"."accounting_voucher_items_direction_enum"`,
    );
  }
}
