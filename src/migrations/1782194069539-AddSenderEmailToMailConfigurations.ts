import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSenderEmailToMailConfigurations1782194069539 implements MigrationInterface {
    name = 'AddSenderEmailToMailConfigurations1782194069539'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "mail_configurations" 
            ADD COLUMN "sender_email" varchar
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "mail_configurations" 
            DROP COLUMN "sender_email"
        `);
    }
}
