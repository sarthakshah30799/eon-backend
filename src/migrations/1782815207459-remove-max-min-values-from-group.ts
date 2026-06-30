import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveMaxMinValuesFromGroup1782815207459 implements MigrationInterface {
    name = 'RemoveMaxMinValuesFromGroup1782815207459'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "currency_rate_groups" DROP COLUMN "buy_min_rate"`);
        await queryRunner.query(`ALTER TABLE "currency_rate_groups" DROP COLUMN "buy_max_rate"`);
        await queryRunner.query(`ALTER TABLE "currency_rate_groups" DROP COLUMN "sale_min_rate"`);
        await queryRunner.query(`ALTER TABLE "currency_rate_groups" DROP COLUMN "sale_max_rate"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "currency_rate_groups" ADD "sale_max_rate" numeric`);
        await queryRunner.query(`ALTER TABLE "currency_rate_groups" ADD "sale_min_rate" numeric`);
        await queryRunner.query(`ALTER TABLE "currency_rate_groups" ADD "buy_max_rate" numeric`);
        await queryRunner.query(`ALTER TABLE "currency_rate_groups" ADD "buy_min_rate" numeric`);
    }

}
