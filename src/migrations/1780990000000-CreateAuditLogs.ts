import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAuditLogs1780990000000 implements MigrationInterface {
    name = 'CreateAuditLogs1780990000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Create audit_logs table
        await queryRunner.query(`
            CREATE TABLE "audit_logs" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "table_name" character varying NOT NULL,
                "action" character varying NOT NULL,
                "row_id" uuid NOT NULL,
                "old_values" jsonb,
                "new_values" jsonb,
                "changed_by" uuid,
                "changed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
            )
        `);

        // 2. Create PL/pgSQL trigger function
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

        // 3. Create AFTER trigger on company table
        await queryRunner.query(`
            CREATE TRIGGER company_audit_trigger
            AFTER INSERT OR UPDATE OR DELETE ON "company"
            FOR EACH ROW
            EXECUTE FUNCTION audit_trigger_func();
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 1. Drop trigger on company table
        await queryRunner.query(`DROP TRIGGER IF EXISTS company_audit_trigger ON "company"`);

        // 2. Drop PL/pgSQL function
        await queryRunner.query(`DROP FUNCTION IF EXISTS audit_trigger_func()`);

        // 3. Drop audit_logs table
        await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    }
}
