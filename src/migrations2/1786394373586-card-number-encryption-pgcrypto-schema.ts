import { MigrationInterface, QueryRunner } from "typeorm";

export class CardNumberEncryptionPgcryptoSchema1786394373586 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER FUNCTION public.encrypt_card_number(text) SET search_path = public, extensions, pg_temp`,
    );
    await queryRunner.query(
      `ALTER FUNCTION public.decrypt_card_number(bytea) SET search_path = public, extensions, pg_temp`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER FUNCTION public.encrypt_card_number(text) SET search_path = public, pg_temp`,
    );
    await queryRunner.query(
      `ALTER FUNCTION public.decrypt_card_number(bytea) SET search_path = public, pg_temp`,
    );
  }
}
