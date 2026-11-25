import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Tax child/header triggers call refresh_transaction_tax_breakdown at depth 1.
 * The nested transactions UPDATE would fire TCS at depth 2, which is skipped by
 * pg_trigger_depth() > 1 — leaving final_amount GST-only after additional charges.
 * Call refresh_transaction_tcs explicitly after every tax breakdown refresh.
 */
export class RefreshTcsAfterTaxBreakdown1795527294418
  implements MigrationInterface
{
  name = "RefreshTcsAfterTaxBreakdown1795527294418";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.transaction_header_tax_breakdown_refresh_trigger()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      DECLARE
        v_transaction_id uuid;
      BEGIN
        IF pg_trigger_depth() > 1 THEN
          RETURN NULL;
        END IF;

        IF TG_OP = 'DELETE' THEN
          v_transaction_id := OLD.id;
        ELSE
          v_transaction_id := NEW.id;
        END IF;

        PERFORM public.refresh_transaction_tax_breakdown(v_transaction_id);
        PERFORM public.refresh_transaction_tcs(v_transaction_id);
        RETURN NULL;
      END;
      $$;
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.transaction_child_tax_breakdown_refresh_trigger()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      DECLARE
        v_transaction_id uuid;
      BEGIN
        IF pg_trigger_depth() > 1 THEN
          RETURN NULL;
        END IF;

        IF TG_OP = 'DELETE' THEN
          v_transaction_id := OLD.transaction_id;
        ELSE
          v_transaction_id := NEW.transaction_id;
        END IF;

        PERFORM public.refresh_transaction_tax_breakdown(v_transaction_id);
        PERFORM public.refresh_transaction_tcs(v_transaction_id);

        IF TG_OP = 'UPDATE' AND OLD.transaction_id IS DISTINCT FROM NEW.transaction_id THEN
          PERFORM public.refresh_transaction_tax_breakdown(OLD.transaction_id);
          PERFORM public.refresh_transaction_tcs(OLD.transaction_id);
        END IF;

        RETURN NULL;
      END;
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.transaction_header_tax_breakdown_refresh_trigger()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      DECLARE
        v_transaction_id uuid;
      BEGIN
        IF pg_trigger_depth() > 1 THEN
          RETURN NULL;
        END IF;

        IF TG_OP = 'DELETE' THEN
          v_transaction_id := OLD.id;
        ELSE
          v_transaction_id := NEW.id;
        END IF;

        PERFORM public.refresh_transaction_tax_breakdown(v_transaction_id);
        RETURN NULL;
      END;
      $$;
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.transaction_child_tax_breakdown_refresh_trigger()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      DECLARE
        v_transaction_id uuid;
      BEGIN
        IF pg_trigger_depth() > 1 THEN
          RETURN NULL;
        END IF;

        IF TG_OP = 'DELETE' THEN
          v_transaction_id := OLD.transaction_id;
        ELSE
          v_transaction_id := NEW.transaction_id;
        END IF;

        PERFORM public.refresh_transaction_tax_breakdown(v_transaction_id);

        IF TG_OP = 'UPDATE' AND OLD.transaction_id IS DISTINCT FROM NEW.transaction_id THEN
          PERFORM public.refresh_transaction_tax_breakdown(OLD.transaction_id);
        END IF;

        RETURN NULL;
      END;
      $$;
    `);
  }
}
