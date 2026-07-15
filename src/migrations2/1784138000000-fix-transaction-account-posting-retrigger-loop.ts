import { MigrationInterface, QueryRunner } from "typeorm";

export class FixTransactionAccountPostingRetriggerLoop1784138000000 implements MigrationInterface {
    name = 'FixTransactionAccountPostingRetriggerLoop1784138000000'

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
              skip_enqueue text := current_setting('app.skip_transaction_account_postings_enqueue', true);
            BEGIN
              IF skip_enqueue = 'true' THEN
                IF TG_OP = 'DELETE' THEN
                  RETURN OLD;
                END IF;

                RETURN NEW;
              END IF;

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
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
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
    }
}
