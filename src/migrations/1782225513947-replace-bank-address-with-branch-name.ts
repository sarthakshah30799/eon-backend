import { MigrationInterface, QueryRunner } from "typeorm";

export class ReplaceBankAddressWithBranchName1782225513947 implements MigrationInterface {
    name = 'ReplaceBankAddressWithBranchName1782225513947'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "party_profiles" RENAME COLUMN "bank_address" TO "bank_branch_name"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "bank_branch_name"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "bank_branch_name" citext`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "party_profiles" DROP COLUMN "bank_branch_name"`);
        await queryRunner.query(`ALTER TABLE "party_profiles" ADD "bank_branch_name" text`);
        await queryRunner.query(`ALTER TABLE "party_profiles" RENAME COLUMN "bank_branch_name" TO "bank_address"`);
    }

}
