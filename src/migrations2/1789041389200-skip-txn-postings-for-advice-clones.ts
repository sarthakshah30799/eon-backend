import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Skip enqueueing ACCOUNT_POSTINGS_REBUILD for Advice destination clones
 * (and any transaction with original_transaction_id set).
 */
export class SkipTxnPostingsForAdviceClones1789041389200
  implements MigrationInterface
{
  name = "SkipTxnPostingsForAdviceClones1789041389200";

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
                  -- Advice destination header clones: no txn account postings.
                  IF NEW.original_transaction_id IS NOT NULL THEN
                    RETURN NEW;
                  END IF;
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

                -- Skip item-side enqueue when parent is an advice/original-linked clone.
                IF EXISTS (
                  SELECT 1
                  FROM transactions t
                  WHERE t.id = affected_transaction_id
                    AND t.original_transaction_id IS NOT NULL
                ) THEN
                  IF TG_OP = 'DELETE' THEN
                    RETURN OLD;
                  END IF;
                  RETURN NEW;
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
    // Restore prior function body from 1784138000000 (no original_transaction_id skip).
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
}
