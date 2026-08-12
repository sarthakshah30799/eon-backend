import { MigrationInterface, QueryRunner } from "typeorm";

export class NormalizePassengerIdentities1786560726767 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE "passengers" SET "pan_number" = NULLIF(upper(regexp_replace(trim("pan_number"), '\\s+', '', 'g')), '') WHERE "pan_number" IS NOT NULL`);
        await queryRunner.query(`UPDATE "passengers" SET "passport_number" = NULLIF(upper(regexp_replace(trim("passport_number"), '\\s+', '', 'g')), '') WHERE "passport_number" IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
