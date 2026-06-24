import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameTcIssuerToCardIssuer1782329269036 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "expense_income_booking_masters" RENAME COLUMN "applicable_tc_issuer" TO "applicable_card_issuer"`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "expense_income_booking_masters" RENAME COLUMN "applicable_card_issuer" TO "applicable_tc_issuer"`
        );
    }


}
