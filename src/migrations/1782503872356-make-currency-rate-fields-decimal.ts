import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeCurrencyRateFieldsDecimal1782503872356 implements MigrationInterface {
    name = 'MakeCurrencyRateFieldsDecimal1782503872356'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "currencies" ALTER COLUMN "rate_per" TYPE numeric USING ("rate_per"::numeric)`);
        await queryRunner.query(`ALTER TABLE "currencies" ALTER COLUMN "default_min_rate" TYPE numeric USING ("default_min_rate"::numeric)`);
        await queryRunner.query(`ALTER TABLE "currencies" ALTER COLUMN "default_max_rate" TYPE numeric USING ("default_max_rate"::numeric)`);
        await queryRunner.query(`ALTER TABLE "currencies" ALTER COLUMN "open_rate_premium" TYPE numeric USING ("open_rate_premium"::numeric)`);
        await queryRunner.query(`ALTER TABLE "currencies" ALTER COLUMN "gulf_disc_factor" TYPE numeric USING ("gulf_disc_factor"::numeric)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "currencies" ALTER COLUMN "gulf_disc_factor" TYPE citext USING ("gulf_disc_factor"::text)`);
        await queryRunner.query(`ALTER TABLE "currencies" ALTER COLUMN "open_rate_premium" TYPE citext USING ("open_rate_premium"::text)`);
        await queryRunner.query(`ALTER TABLE "currencies" ALTER COLUMN "default_max_rate" TYPE citext USING ("default_max_rate"::text)`);
        await queryRunner.query(`ALTER TABLE "currencies" ALTER COLUMN "default_min_rate" TYPE citext USING ("default_min_rate"::text)`);
        await queryRunner.query(`ALTER TABLE "currencies" ALTER COLUMN "rate_per" TYPE citext USING ("rate_per"::text)`);
    }

}
