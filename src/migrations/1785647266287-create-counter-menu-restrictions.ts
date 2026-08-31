import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCounterMenuRestrictions1785647266287 implements MigrationInterface {
  name = "CreateCounterMenuRestrictions1785647266287";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "counter_menu_restrictions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "counter_id" uuid NOT NULL, "menu_id" uuid NOT NULL, "permission_id" uuid NOT NULL, CONSTRAINT "UQ_e6b8be0ce01d6a49a40a93136cf" UNIQUE ("counter_id", "menu_id", "permission_id"), CONSTRAINT "PK_3d045acdfd87573e89c4d86d79f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cd54b9381e236034e4c674dd49" ON "counter_menu_restrictions" ("counter_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f5752319b4ce26e118ee377787" ON "counter_menu_restrictions" ("menu_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_41ae9c3e429a5afcd6eaf55c9f" ON "counter_menu_restrictions" ("permission_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "counter_menu_restrictions" ADD CONSTRAINT "FK_cd54b9381e236034e4c674dd493" FOREIGN KEY ("counter_id") REFERENCES "counters"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "counter_menu_restrictions" ADD CONSTRAINT "FK_f5752319b4ce26e118ee3777875" FOREIGN KEY ("menu_id") REFERENCES "menus"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "counter_menu_restrictions" ADD CONSTRAINT "FK_41ae9c3e429a5afcd6eaf55c9ff" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "counter_menu_restrictions" DROP CONSTRAINT "FK_41ae9c3e429a5afcd6eaf55c9ff"`,
    );
    await queryRunner.query(
      `ALTER TABLE "counter_menu_restrictions" DROP CONSTRAINT "FK_f5752319b4ce26e118ee3777875"`,
    );
    await queryRunner.query(
      `ALTER TABLE "counter_menu_restrictions" DROP CONSTRAINT "FK_cd54b9381e236034e4c674dd493"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_41ae9c3e429a5afcd6eaf55c9f"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f5752319b4ce26e118ee377787"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cd54b9381e236034e4c674dd49"`,
    );
    await queryRunner.query(`DROP TABLE "counter_menu_restrictions"`);
  }
}
