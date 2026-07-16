import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeCounterIdNotNullable1784182160186 implements MigrationInterface {
    name = 'MakeCounterIdNotNullable1784182160186'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "counter_id" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "counter_id" DROP NOT NULL`);
    }

}
