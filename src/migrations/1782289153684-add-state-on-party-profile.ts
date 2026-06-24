import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStateOnPartyProfile1782289153684 implements MigrationInterface {
    name = 'AddStateOnPartyProfile1782289153684'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "state_id" uuid`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD CONSTRAINT "FK_party_profiles_state_id" FOREIGN KEY ("state_id") REFERENCES "states"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP CONSTRAINT "FK_party_profiles_state_id"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "state_id"`);
    }

}
