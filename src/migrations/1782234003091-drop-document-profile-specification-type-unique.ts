import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropDocumentProfileSpecificationTypeUnique1782234003091
  implements MigrationInterface
{
  name = 'DropDocumentProfileSpecificationTypeUnique1782234003091';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "public"."IDX_7742c71276e146ea2875340cc4"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_7742c71276e146ea2875340cc4"
      ON "document_profiles" ("specification_type")
    `);
  }
}
