import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCommonStatus1782119755011 implements MigrationInterface {
    name = 'AddCommonStatus1782119755011'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."entity_status_enum" AS ENUM('pending', 'approve', 'reject')`);
        await queryRunner.query(`ALTER TABLE "corporate_clients" ADD "status" "public"."entity_status_enum" NOT NULL DEFAULT 'pending'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "corporate_clients" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."entity_status_enum"`);
    }

}
