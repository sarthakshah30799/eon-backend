import { MigrationInterface, QueryRunner } from "typeorm";

export class AddVoucherPanNameDob1786889093654 implements MigrationInterface {
    name = 'AddVoucherPanNameDob1786889093654'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" ADD "pan_name" citext`);
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" ADD "pan_dob" date`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" DROP COLUMN "pan_dob"`);
        await queryRunner.query(`ALTER TABLE "accounting_vouchers" DROP COLUMN "pan_name"`);
    }

}
