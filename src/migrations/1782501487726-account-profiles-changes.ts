import { MigrationInterface, QueryRunner } from "typeorm";

export class AccountProfilesChanges1782501487726 implements MigrationInterface {
    name = 'AccountProfilesChanges1782501487726'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "account_profiles" RENAME COLUMN "do_sale" TO "retail_sale"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" RENAME COLUMN "do_purchase" TO "retail_purchase"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" RENAME COLUMN "do_receipt" TO "receipt"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" RENAME COLUMN "do_payment" TO "payment"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" ADD "bulk_sale" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "account_profiles" ADD "bulk_purchase" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "account_profiles" ADD "expense" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "account_profiles" ADD "journal_voucher" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "account_profiles" DROP COLUMN "journal_voucher"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" DROP COLUMN "expense"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" DROP COLUMN "bulk_purchase"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" DROP COLUMN "bulk_sale"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" RENAME COLUMN "payment" TO "do_payment"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" RENAME COLUMN "receipt" TO "do_receipt"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" RENAME COLUMN "retail_purchase" TO "do_purchase"`);
        await queryRunner.query(`ALTER TABLE "account_profiles" RENAME COLUMN "retail_sale" TO "do_sale"`);
    }

}
