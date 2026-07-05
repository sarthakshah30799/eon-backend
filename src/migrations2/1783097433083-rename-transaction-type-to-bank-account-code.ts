import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameTransactionTypeToBankAccountCode1783097433083 implements MigrationInterface {
    name = 'RenameTransactionTypeToBankAccountCode1783097433083'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cheque_books" RENAME COLUMN "transaction_type" TO "bank_account_code"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cheque_books" RENAME COLUMN "bank_account_code" TO "transaction_type"`);
    }

}
