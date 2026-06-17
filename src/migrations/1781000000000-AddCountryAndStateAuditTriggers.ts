import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCountryAndStateAuditTriggers1781000000000 implements MigrationInterface {
    name = 'AddCountryAndStateAuditTriggers1781000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Create AFTER trigger on countries table
        await queryRunner.query(`
            CREATE TRIGGER country_audit_trigger
            AFTER INSERT OR UPDATE OR DELETE ON "countries"
            FOR EACH ROW
            EXECUTE FUNCTION audit_trigger_func();
        `);

        // 2. Create AFTER trigger on states table
        await queryRunner.query(`
            CREATE TRIGGER state_audit_trigger
            AFTER INSERT OR UPDATE OR DELETE ON "states"
            FOR EACH ROW
            EXECUTE FUNCTION audit_trigger_func();
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 1. Drop trigger on countries table
        await queryRunner.query(`DROP TRIGGER IF EXISTS country_audit_trigger ON "countries"`);

        // 2. Drop trigger on states table
        await queryRunner.query(`DROP TRIGGER IF EXISTS state_audit_trigger ON "states"`);
    }
}
