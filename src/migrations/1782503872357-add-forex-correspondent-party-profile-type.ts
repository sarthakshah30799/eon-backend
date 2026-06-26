import { MigrationInterface, QueryRunner } from "typeorm";

export class AddForexCorrespondentPartyProfileType1782503872357 implements MigrationInterface {
    name = 'AddForexCorrespondentPartyProfileType1782503872357'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."party_profiles_type_enum" ADD VALUE IF NOT EXISTS 'FOREX_CORRESPONDENT'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."party_profiles_type_enum" DROP VALUE IF EXISTS 'FOREX_CORRESPONDENT'`);
    }

}
