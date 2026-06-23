import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMailConfigurationsTable1782194069538 implements MigrationInterface {
    name = 'CreateMailConfigurationsTable1782194069538'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "mail_configurations" (
                "username" varchar NOT NULL,
                "host" varchar NOT NULL,
                "port" integer NOT NULL,
                "password" varchar NOT NULL,
                CONSTRAINT "PK_mail_configurations" PRIMARY KEY ("username")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "mail_configurations"`);
    }
}
