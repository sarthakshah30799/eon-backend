import { MigrationInterface, QueryRunner } from "typeorm";

// Tables already covered by earlier migrations:
//   company              → 1780990000000-CreateAuditLogs
//   countries, states    → 1781000000000-AddCountryAndStateAuditTriggers
//
// This migration adds AFTER INSERT/UPDATE/DELETE triggers (row-level) to every
// remaining application table so all changes are captured in audit_logs.

const TABLES = [
    "users",
    "roles",
    "branches",
    "menus",
    "permissions",
    "products",
    "currencies",
    "category_options",
    "counters",
    "country_groups",
    "financial_codes",
    "financial_sub_profiles",
    "account_profiles",
    "corporate_clients",
    "advanced_settings",
    "user_roles",
    "roles_menu_permissions",
];

export class AddAuditTriggersToRemainingTables1781020000000 implements MigrationInterface {
    name = 'AddAuditTriggersToRemainingTables1781020000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const table of TABLES) {
            const triggerName = `${table}_audit_trigger`;
            await queryRunner.query(`
                CREATE TRIGGER ${triggerName}
                AFTER INSERT OR UPDATE OR DELETE ON "${table}"
                FOR EACH ROW
                EXECUTE FUNCTION audit_trigger_func();
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop in reverse order
        for (const table of [...TABLES].reverse()) {
            const triggerName = `${table}_audit_trigger`;
            await queryRunner.query(
                `DROP TRIGGER IF EXISTS ${triggerName} ON "${table}"`
            );
        }
    }
}
