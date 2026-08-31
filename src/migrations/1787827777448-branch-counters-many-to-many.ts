import { MigrationInterface, QueryRunner } from "typeorm";

export class BranchCountersManyToMany1787827777448 implements MigrationInterface {
  name = "BranchCountersManyToMany1787827777448";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "branch_counters" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "deleted_at" TIMESTAMP WITH TIME ZONE, "deleted_by" uuid, "branch_id" uuid NOT NULL, "counter_id" uuid NOT NULL, CONSTRAINT "UQ_branch_counters_branch_counter" UNIQUE ("branch_id", "counter_id"), CONSTRAINT "PK_da6ff8729e190238031b0bdff5c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_branch_counters_counter_id" ON "branch_counters" ("counter_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_branch_counters_branch_id" ON "branch_counters" ("branch_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_counters" ADD CONSTRAINT "FK_f4acf01185eeffb07cfbeacdeb2" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_counters" ADD CONSTRAINT "FK_62a25d5dc0851aa7fab4477d12f" FOREIGN KEY ("counter_id") REFERENCES "counters"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // Sync existing exclusive ownership into many-to-many links.
    await queryRunner.query(`
            INSERT INTO "branch_counters" ("id", "created_at", "updated_at", "created_by", "updated_by", "branch_id", "counter_id")
            SELECT uuid_generate_v4(), now(), now(),
                   COALESCE(c.updated_by, c.created_by),
                   COALESCE(c.updated_by, c.created_by),
                   c.branch_id,
                   c.id
            FROM "counters" c
            WHERE c.branch_id IS NOT NULL
              AND c.deleted_at IS NULL
            ON CONFLICT ("branch_id", "counter_id") DO NOTHING
        `);

    // Recover stolen/shared pairs still present on user assignments.
    await queryRunner.query(`
            INSERT INTO "branch_counters" ("id", "created_at", "updated_at", "created_by", "updated_by", "branch_id", "counter_id")
            SELECT uuid_generate_v4(), now(), now(),
                   COALESCE(ur.updated_by, ur.created_by),
                   COALESCE(ur.updated_by, ur.created_by),
                   ur.branch_id,
                   ur.counter_id
            FROM "user_roles" ur
            INNER JOIN "branches" b ON b.id = ur.branch_id AND b.deleted_at IS NULL
            INNER JOIN "counters" c ON c.id = ur.counter_id AND c.deleted_at IS NULL
            WHERE ur.deleted_at IS NULL
              AND ur.branch_id IS NOT NULL
              AND ur.counter_id IS NOT NULL
            ON CONFLICT ("branch_id", "counter_id") DO NOTHING
        `);

    await queryRunner.query(
      `ALTER TABLE "counters" DROP CONSTRAINT "FK_9cacc3ad698208a6a895891b2da"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9cacc3ad698208a6a895891b2d"`,
    );
    await queryRunner.query(`ALTER TABLE "counters" DROP COLUMN "branch_id"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "counters" ADD "branch_id" uuid`);
    await queryRunner.query(`
            UPDATE "counters" c
            SET "branch_id" = link.branch_id
            FROM (
                SELECT DISTINCT ON ("counter_id") "counter_id", "branch_id"
                FROM "branch_counters"
                WHERE "deleted_at" IS NULL
                ORDER BY "counter_id", "created_at" ASC
            ) link
            WHERE c.id = link.counter_id
        `);
    await queryRunner.query(
      `CREATE INDEX "IDX_9cacc3ad698208a6a895891b2d" ON "counters" ("branch_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "counters" ADD CONSTRAINT "FK_9cacc3ad698208a6a895891b2da" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "branch_counters" DROP CONSTRAINT "FK_62a25d5dc0851aa7fab4477d12f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "branch_counters" DROP CONSTRAINT "FK_f4acf01185eeffb07cfbeacdeb2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_branch_counters_branch_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_branch_counters_counter_id"`,
    );
    await queryRunner.query(`DROP TABLE "branch_counters"`);
  }
}
