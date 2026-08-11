import { MigrationInterface, QueryRunner } from "typeorm";

export class StockRevaluation1785786974950 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."stock_revaluation_frequency_enum" AS ENUM('MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY')`);
        await queryRunner.query(`CREATE TYPE "public"."stock_revaluation_status_enum" AS ENUM('PENDING', 'PROCESSED')`);
        await queryRunner.query(`CREATE TABLE "stock_revaluations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "branch_id" uuid NOT NULL, "branch_snapshot" jsonb, "frequency" "public"."stock_revaluation_frequency_enum" NOT NULL, "valuation_date" date NOT NULL, "uploaded_date" date NOT NULL, "status" "public"."stock_revaluation_status_enum" NOT NULL DEFAULT 'PENDING', "uploaded_rates" jsonb, CONSTRAINT "PK_stock_revaluations" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "stock_revaluations" ADD "counter_id" uuid NOT NULL`);
        await queryRunner.query(`ALTER TABLE "stock_revaluations" ADD "counter_snapshot" jsonb`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_stock_revaluations_branch_counter_period" ON "stock_revaluations" ("branch_id", "counter_id", "frequency", "valuation_date")`);
        await queryRunner.query(`CREATE INDEX "IDX_stock_revaluations_branch_date" ON "stock_revaluations" ("branch_id", "valuation_date")`);
        await queryRunner.query(`CREATE TABLE "stock_revaluation_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "revaluation_id" uuid NOT NULL, "line_no" integer NOT NULL, "currency_id" uuid NOT NULL, "currency_snapshot" jsonb, "closing_quantity" numeric(18,7) NOT NULL DEFAULT '0', "awp" numeric(18,7) NOT NULL DEFAULT '0', "closing_inr_amount" numeric(18,2) NOT NULL DEFAULT '0', "new_rate" numeric(18,7) NOT NULL, "new_inr_amount" numeric(18,2) NOT NULL DEFAULT '0', "difference_inr" numeric(18,2) NOT NULL DEFAULT '0', CONSTRAINT "PK_stock_revaluation_items" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_stock_revaluation_items_revaluation_line" ON "stock_revaluation_items" ("revaluation_id", "line_no")`);
        await queryRunner.query(`CREATE INDEX "IDX_stock_revaluation_items_currency" ON "stock_revaluation_items" ("currency_id")`);
        await queryRunner.query(`ALTER TABLE "stock_revaluation_items" ADD CONSTRAINT "FK_stock_revaluation_items_revaluation" FOREIGN KEY ("revaluation_id") REFERENCES "stock_revaluations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`CREATE OR REPLACE FUNCTION public.calculate_stock_revaluation(p_branch_id uuid, p_counter_id uuid, p_valuation_date date, p_rates jsonb) RETURNS jsonb LANGUAGE sql STABLE AS $function$
          WITH requested AS (
            SELECT
              (value->>'currencyId')::uuid AS currency_id,
              value->>'currencyCode' AS currency_code,
              value->>'currencyName' AS currency_name,
              (value->>'rate')::numeric AS new_rate
            FROM jsonb_array_elements(p_rates) AS entry(value)
          ), latest_profile_rows AS (
            SELECT DISTINCT ON (b.currency_id, b.profiletype)
              b.currency_id, b.profiletype, b.closing, b.closingrs
            FROM transaction_balance_currencies b
            WHERE b.branch_id = p_branch_id AND b.counter_id = p_counter_id AND b.date::date <= p_valuation_date
            ORDER BY b.currency_id, b.profiletype, b.date DESC, b.updated_at DESC
          ), totals AS (
            SELECT currency_id, COALESCE(SUM(closing), 0) AS closing_quantity, COALESCE(SUM(closingrs), 0) AS closing_inr_amount
            FROM latest_profile_rows GROUP BY currency_id
          )
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'currencyId', r.currency_id,
            'currencyCode', r.currency_code,
            'currencyName', r.currency_name,
            'closingQuantity', ROUND(COALESCE(t.closing_quantity, 0), 7),
            'awp', CASE WHEN COALESCE(t.closing_quantity, 0) = 0 THEN 0 ELSE ROUND(COALESCE(t.closing_inr_amount, 0) / t.closing_quantity, 7) END,
            'closingInrAmount', ROUND(COALESCE(t.closing_inr_amount, 0), 2),
            'newRate', r.new_rate,
            'newInrAmount', ROUND(COALESCE(t.closing_quantity, 0) * r.new_rate, 2),
            'differenceInr', ROUND((COALESCE(t.closing_quantity, 0) * r.new_rate) - COALESCE(t.closing_inr_amount, 0), 2)
          ) ORDER BY r.currency_code), '[]'::jsonb)
          FROM requested r LEFT JOIN totals t ON t.currency_id = r.currency_id;
        $function$`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP FUNCTION IF EXISTS public.calculate_stock_revaluation(uuid, uuid, date, jsonb)`);
        await queryRunner.query(`ALTER TABLE "stock_revaluation_items" DROP CONSTRAINT "FK_stock_revaluation_items_revaluation"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_stock_revaluation_items_currency"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_stock_revaluation_items_revaluation_line"`);
        await queryRunner.query(`DROP TABLE "stock_revaluation_items"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_stock_revaluations_branch_date"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_stock_revaluations_branch_counter_period"`);
        await queryRunner.query(`DROP TABLE "stock_revaluations"`);
        await queryRunner.query(`DROP TYPE "public"."stock_revaluation_frequency_enum"`);
        await queryRunner.query(`DROP TYPE "public"."stock_revaluation_status_enum"`);
    }

}
