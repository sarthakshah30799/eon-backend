import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVoucherAccountPostingsTrigger1789022140100 implements MigrationInterface {
  name = "AddVoucherAccountPostingsTrigger1789022140100";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE OR REPLACE FUNCTION public.enqueue_voucher_account_postings_rebuild()
            RETURNS trigger
            LANGUAGE plpgsql
            AS $$
            DECLARE
              affected_voucher_id uuid;
              actor_id uuid;
              operation_name text := TG_OP;
              skip_enqueue text := current_setting('app.skip_voucher_account_postings_enqueue', true);
            BEGIN
              IF skip_enqueue = 'true' THEN
                IF TG_OP = 'DELETE' THEN
                  RETURN OLD;
                END IF;

                RETURN NEW;
              END IF;

              IF TG_TABLE_NAME = 'accounting_vouchers' THEN
                IF TG_OP = 'DELETE' THEN
                  affected_voucher_id := OLD.id;
                  actor_id := COALESCE(OLD.updated_by, OLD.created_by);
                ELSE
                  affected_voucher_id := NEW.id;
                  actor_id := COALESCE(NEW.updated_by, NEW.created_by);
                END IF;
              ELSE
                IF TG_OP = 'DELETE' THEN
                  affected_voucher_id := OLD.voucher_id;
                  actor_id := COALESCE(OLD.updated_by, OLD.created_by);
                ELSE
                  affected_voucher_id := NEW.voucher_id;
                  actor_id := COALESCE(NEW.updated_by, NEW.created_by);
                END IF;
              END IF;

              DELETE FROM voucher_events
              WHERE voucher_id = affected_voucher_id
                AND event_type = 'ACCOUNT_POSTINGS_REBUILD'
                AND status IN ('PENDING', 'PROCESSING');

              INSERT INTO voucher_events (
                id,
                created_at,
                updated_at,
                created_by,
                updated_by,
                voucher_id,
                event_type,
                payload,
                status,
                attempt_count,
                available_at,
                processed_at,
                error_message,
                locked_at,
                locked_by_id
              )
              VALUES (
                uuid_generate_v4(),
                now(),
                now(),
                actor_id,
                actor_id,
                affected_voucher_id,
                'ACCOUNT_POSTINGS_REBUILD',
                jsonb_build_object(
                  'voucherId', affected_voucher_id,
                  'tableName', TG_TABLE_NAME,
                  'operation', operation_name
                ),
                'PENDING',
                0,
                now(),
                NULL,
                NULL,
                NULL,
                NULL
              );

              IF TG_OP = 'DELETE' THEN
                RETURN OLD;
              END IF;

              RETURN NEW;
            END;
            $$;
        `);

    await queryRunner.query(`
            DROP TRIGGER IF EXISTS voucher_account_postings_rebuild_on_accounting_vouchers ON "accounting_vouchers";
            CREATE TRIGGER voucher_account_postings_rebuild_on_accounting_vouchers
            AFTER INSERT OR UPDATE OR DELETE ON "accounting_vouchers"
            FOR EACH ROW
            EXECUTE FUNCTION public.enqueue_voucher_account_postings_rebuild();
        `);

    await queryRunner.query(`
            DROP TRIGGER IF EXISTS voucher_account_postings_rebuild_on_accounting_voucher_items ON "accounting_voucher_items";
            CREATE TRIGGER voucher_account_postings_rebuild_on_accounting_voucher_items
            AFTER INSERT OR UPDATE OR DELETE ON "accounting_voucher_items"
            FOR EACH ROW
            EXECUTE FUNCTION public.enqueue_voucher_account_postings_rebuild();
        `);

    // Backfill rebuild events for existing vouchers (R/P/JV/DW).
    await queryRunner.query(`
            INSERT INTO voucher_events (
              id,
              created_at,
              updated_at,
              created_by,
              updated_by,
              voucher_id,
              event_type,
              payload,
              status,
              attempt_count,
              available_at,
              processed_at,
              error_message,
              locked_at,
              locked_by_id
            )
            SELECT
              uuid_generate_v4(),
              now(),
              now(),
              COALESCE(v.updated_by, v.created_by),
              COALESCE(v.updated_by, v.created_by),
              v.id,
              'ACCOUNT_POSTINGS_REBUILD',
              jsonb_build_object(
                'voucherId', v.id,
                'source', 'backfill'
              ),
              'PENDING',
              0,
              now(),
              NULL,
              NULL,
              NULL,
              NULL
            FROM accounting_vouchers v
            WHERE v.deleted_at IS NULL
              AND NOT EXISTS (
                SELECT 1
                FROM voucher_events e
                WHERE e.voucher_id = v.id
                  AND e.event_type = 'ACCOUNT_POSTINGS_REBUILD'
                  AND e.status IN ('PENDING', 'PROCESSING')
              );
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP TRIGGER IF EXISTS voucher_account_postings_rebuild_on_accounting_voucher_items ON "accounting_voucher_items";
        `);
    await queryRunner.query(`
            DROP TRIGGER IF EXISTS voucher_account_postings_rebuild_on_accounting_vouchers ON "accounting_vouchers";
        `);
    await queryRunner.query(`
            DROP FUNCTION IF EXISTS public.enqueue_voucher_account_postings_rebuild();
        `);
  }
}
