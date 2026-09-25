import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameLoadToClosingControlAccounts1790314914559
  implements MigrationInterface
{
  name = "RenameLoadToClosingControlAccounts1790314914559";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "advanced_settings"
      SET "code" = CASE "code"
        WHEN 'CARD_LOAD_CONTROL_ACCOUNT' THEN 'CARD_CLOSING_CONTROL_ACCOUNT'
        WHEN 'CM_LOAD_CONTROL_ACCOUNT' THEN 'CM_CLOSING_CONTROL_ACCOUNT'
        WHEN 'TT_LOAD_CONTROL_ACCOUNT' THEN 'TT_CLOSING_CONTROL_ACCOUNT'
        ELSE "code"
      END
      WHERE "code" IN (
        'CARD_LOAD_CONTROL_ACCOUNT',
        'CM_LOAD_CONTROL_ACCOUNT',
        'TT_LOAD_CONTROL_ACCOUNT'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "advanced_settings"
      SET "code" = CASE "code"
        WHEN 'CARD_CLOSING_CONTROL_ACCOUNT' THEN 'CARD_LOAD_CONTROL_ACCOUNT'
        WHEN 'CM_CLOSING_CONTROL_ACCOUNT' THEN 'CM_LOAD_CONTROL_ACCOUNT'
        WHEN 'TT_CLOSING_CONTROL_ACCOUNT' THEN 'TT_LOAD_CONTROL_ACCOUNT'
        ELSE "code"
      END
      WHERE "code" IN (
        'CARD_CLOSING_CONTROL_ACCOUNT',
        'CM_CLOSING_CONTROL_ACCOUNT',
        'TT_CLOSING_CONTROL_ACCOUNT'
      )
    `);
  }
}
