import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTransactionAccountPostingsTrigger1784123978502 implements MigrationInterface {
    name = 'AddTransactionAccountPostingsTrigger1784123978502'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION public.enqueue_transaction_account_postings_rebuild()
            RETURNS trigger
            LANGUAGE plpgsql
            AS $$
            DECLARE
              affected_transaction_id uuid;
              actor_id uuid;
              operation_name text := TG_OP;
            BEGIN
              IF TG_TABLE_NAME = 'transactions' THEN
                IF TG_OP = 'DELETE' THEN
                  affected_transaction_id := OLD.id;
                  actor_id := COALESCE(OLD.updated_by, OLD.created_by);
                ELSE
                  affected_transaction_id := NEW.id;
                  actor_id := COALESCE(NEW.updated_by, NEW.created_by);
                END IF;
              ELSE
                IF TG_OP = 'DELETE' THEN
                  affected_transaction_id := OLD.transaction_id;
                  actor_id := COALESCE(OLD.updated_by, OLD.created_by);
                ELSE
                  affected_transaction_id := NEW.transaction_id;
                  actor_id := COALESCE(NEW.updated_by, NEW.created_by);
                END IF;
              END IF;

              DELETE FROM transaction_events
              WHERE transaction_id = affected_transaction_id
                AND event_type = 'ACCOUNT_POSTINGS_REBUILD'
                AND status IN ('PENDING', 'PROCESSING');

              INSERT INTO transaction_events (
                id,
                created_at,
                updated_at,
                created_by,
                updated_by,
                transaction_id,
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
                affected_transaction_id,
                'ACCOUNT_POSTINGS_REBUILD',
                jsonb_build_object(
                  'transactionId', affected_transaction_id,
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
            DROP TRIGGER IF EXISTS transaction_account_postings_rebuild_on_transactions ON "transactions";
            CREATE TRIGGER transaction_account_postings_rebuild_on_transactions
            AFTER INSERT OR UPDATE OR DELETE ON "transactions"
            FOR EACH ROW
            EXECUTE FUNCTION public.enqueue_transaction_account_postings_rebuild();
        `);
        await queryRunner.query(`
            DROP TRIGGER IF EXISTS transaction_account_postings_rebuild_on_transaction_items ON "transaction_items";
            CREATE TRIGGER transaction_account_postings_rebuild_on_transaction_items
            AFTER INSERT OR UPDATE OR DELETE ON "transaction_items"
            FOR EACH ROW
            EXECUTE FUNCTION public.enqueue_transaction_account_postings_rebuild();
        `);
        await queryRunner.query(`
            DROP TRIGGER IF EXISTS transaction_account_postings_rebuild_on_transaction_payments ON "transaction_payments";
            CREATE TRIGGER transaction_account_postings_rebuild_on_transaction_payments
            AFTER INSERT OR UPDATE OR DELETE ON "transaction_payments"
            FOR EACH ROW
            EXECUTE FUNCTION public.enqueue_transaction_account_postings_rebuild();
        `);
        await queryRunner.query(`
            DROP TRIGGER IF EXISTS transaction_account_postings_rebuild_on_transaction_additional_charges ON "transaction_additional_charges";
            CREATE TRIGGER transaction_account_postings_rebuild_on_transaction_additional_charges
            AFTER INSERT OR UPDATE OR DELETE ON "transaction_additional_charges"
            FOR EACH ROW
            EXECUTE FUNCTION public.enqueue_transaction_account_postings_rebuild();
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP TRIGGER IF EXISTS transaction_account_postings_rebuild_on_transaction_additional_charges ON "transaction_additional_charges";
        `);
        await queryRunner.query(`
            DROP TRIGGER IF EXISTS transaction_account_postings_rebuild_on_transaction_payments ON "transaction_payments";
        `);
        await queryRunner.query(`
            DROP TRIGGER IF EXISTS transaction_account_postings_rebuild_on_transaction_items ON "transaction_items";
        `);
        await queryRunner.query(`
            DROP TRIGGER IF EXISTS transaction_account_postings_rebuild_on_transactions ON "transactions";
        `);
        await queryRunner.query(`
            DROP FUNCTION IF EXISTS public.enqueue_transaction_account_postings_rebuild();
        `);
    }

}
