import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateExpenseincomeEntity1782750930716 implements MigrationInterface {
    name = 'UpdateExpenseincomeEntity1782750930716'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "expense_income_booking_masters" DROP COLUMN "interstate_transaction"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "expense_income_booking_masters" ADD "interstate_transaction" boolean NOT NULL DEFAULT false`);
    }

}
