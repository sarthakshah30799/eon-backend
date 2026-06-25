import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveExtraFieldsPartyProfiles1782413716265 implements MigrationInterface {
    name = 'RemoveExtraFieldsPartyProfiles1782413716265'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "sgst_no"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "igst_no"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "cancelled_cheque_copy"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "cancelled_cheque_copy" text`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "igst_no" citext`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "sgst_no" citext`);
    }

}
