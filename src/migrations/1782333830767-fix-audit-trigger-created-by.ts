import { MigrationInterface, QueryRunner } from "typeorm";

export class FixAuditTriggerCreatedBy1782333830767 implements MigrationInterface {
    name = 'FixAuditTriggerCreatedBy1782333830767'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION audit_trigger_func()
            RETURNS TRIGGER AS $$
            DECLARE
                old_data jsonb := NULL;
                new_data jsonb := NULL;
                user_id uuid := NULL;
                row_id uuid := NULL;
            BEGIN
                IF (TG_OP = 'INSERT') THEN
                    new_data := to_jsonb(NEW);
                    user_id := COALESCE(
                        NULLIF(new_data->>'created_by', '')::uuid,
                        NULLIF(new_data->>'createdBy', '')::uuid
                    );
                    row_id := (new_data->>'id')::uuid;
                ELSIF (TG_OP = 'UPDATE') THEN
                    old_data := to_jsonb(OLD);
                    new_data := to_jsonb(NEW);
                    user_id := COALESCE(
                        NULLIF(new_data->>'updated_by', '')::uuid,
                        NULLIF(new_data->>'updatedBy', '')::uuid
                    );
                    row_id := (new_data->>'id')::uuid;
                ELSIF (TG_OP = 'DELETE') THEN
                    old_data := to_jsonb(OLD);
                    user_id := COALESCE(
                        NULLIF(old_data->>'updated_by', '')::uuid,
                        NULLIF(old_data->>'updatedBy', '')::uuid
                    );
                    row_id := (old_data->>'id')::uuid;
                END IF;

                INSERT INTO "audit_logs" (
                    "table_name",
                    "action",
                    "row_id",
                    "old_values",
                    "new_values",
                    "changed_by",
                    "changed_at"
                ) VALUES (
                    TG_TABLE_NAME,
                    TG_OP,
                    row_id,
                    old_data,
                    new_data,
                    user_id,
                    now()
                );

                IF (TG_OP = 'DELETE') THEN
                    RETURN OLD;
                ELSE
                    RETURN NEW;
                END IF;
            END;
            $$ LANGUAGE plpgsql;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION audit_trigger_func()
            RETURNS TRIGGER AS $$
            DECLARE
                old_data jsonb := NULL;
                new_data jsonb := NULL;
                user_id uuid := NULL;
                row_id uuid := NULL;
            BEGIN
                IF (TG_OP = 'INSERT') THEN
                    new_data := to_jsonb(NEW);
                    user_id := NEW.created_by;
                    row_id := NEW.id;
                ELSIF (TG_OP = 'UPDATE') THEN
                    old_data := to_jsonb(OLD);
                    new_data := to_jsonb(NEW);
                    user_id := NEW.updated_by;
                    row_id := NEW.id;
                ELSIF (TG_OP = 'DELETE') THEN
                    old_data := to_jsonb(OLD);
                    user_id := OLD.updated_by;
                    row_id := OLD.id;
                END IF;

                INSERT INTO "audit_logs" (
                    "table_name",
                    "action",
                    "row_id",
                    "old_values",
                    "new_values",
                    "changed_by",
                    "changed_at"
                ) VALUES (
                    TG_TABLE_NAME,
                    TG_OP,
                    row_id,
                    old_data,
                    new_data,
                    user_id,
                    now()
                );

                IF (TG_OP = 'DELETE') THEN
                    RETURN OLD;
                ELSE
                    RETURN NEW;
                END IF;
            END;
            $$ LANGUAGE plpgsql;
        `);
    }
}
