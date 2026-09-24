import { MigrationInterface, QueryRunner } from "typeorm";

export class PartyProfileGstNoExempt1790232070778 implements MigrationInterface {
    name = 'PartyProfileGstNoExempt1790232070778'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "gst_exempt" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "gst_exempt"`);
    }

}
