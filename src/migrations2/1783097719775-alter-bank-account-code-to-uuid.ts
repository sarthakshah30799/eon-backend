import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterBankAccountCodeToUuid1783097719775 implements MigrationInterface {
    name = 'AlterBankAccountCodeToUuid1783097719775'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cheque_books" DROP COLUMN "bank_account_code"`);
        await queryRunner.query(`ALTER TABLE "cheque_books" ADD "bank_account_code" uuid`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cheque_books" DROP COLUMN "bank_account_code"`);
        await queryRunner.query(`ALTER TABLE "cheque_books" ADD "bank_account_code" character varying(100)`);
    }

}
