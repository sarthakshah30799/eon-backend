import { MigrationInterface, QueryRunner } from "typeorm";

export class CardNumberEncryptionVaultFunctions1786393709275 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE OR REPLACE FUNCTION public.encrypt_card_number(input_value text)
            RETURNS bytea
            LANGUAGE plpgsql
            SECURITY DEFINER
            SET search_path = public, pg_temp
            AS $function$
            DECLARE
                encryption_key text;
            BEGIN
                SELECT decrypted_secret
                INTO encryption_key
                FROM vault.decrypted_secrets
                WHERE name = 'card_encryption_key'
                LIMIT 1;

                IF COALESCE(encryption_key, '') = '' THEN
                    RAISE EXCEPTION 'Supabase Vault secret card_encryption_key is not configured';
                END IF;

                RETURN pgp_sym_encrypt(input_value, encryption_key, 'cipher-algo=aes256');
            END;
            $function$;
        `);
    await queryRunner.query(`
            CREATE OR REPLACE FUNCTION public.decrypt_card_number(input_value bytea)
            RETURNS text
            LANGUAGE plpgsql
            SECURITY DEFINER
            SET search_path = public, pg_temp
            AS $function$
            DECLARE
                encryption_key text;
            BEGIN
                SELECT decrypted_secret
                INTO encryption_key
                FROM vault.decrypted_secrets
                WHERE name = 'card_encryption_key'
                LIMIT 1;

                IF COALESCE(encryption_key, '') = '' THEN
                    RAISE EXCEPTION 'Supabase Vault secret card_encryption_key is not configured';
                END IF;

                RETURN pgp_sym_decrypt(input_value, encryption_key);
            END;
            $function$;
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE OR REPLACE FUNCTION public.encrypt_card_number(input_value text)
            RETURNS bytea
            LANGUAGE plpgsql
            SECURITY DEFINER
            SET search_path = public, pg_temp
            AS $function$
            DECLARE
                encryption_key text;
            BEGIN
                encryption_key := current_setting('app.card_encryption_key', true);
                IF COALESCE(encryption_key, '') = '' THEN
                    RAISE EXCEPTION 'PostgreSQL setting app.card_encryption_key is not configured';
                END IF;

                RETURN pgp_sym_encrypt(input_value, encryption_key, 'cipher-algo=aes256');
            END;
            $function$;
        `);
    await queryRunner.query(`
            CREATE OR REPLACE FUNCTION public.decrypt_card_number(input_value bytea)
            RETURNS text
            LANGUAGE plpgsql
            SECURITY DEFINER
            SET search_path = public, pg_temp
            AS $function$
            DECLARE
                encryption_key text;
            BEGIN
                encryption_key := current_setting('app.card_encryption_key', true);
                IF COALESCE(encryption_key, '') = '' THEN
                    RAISE EXCEPTION 'PostgreSQL setting app.card_encryption_key is not configured';
                END IF;

                RETURN pgp_sym_decrypt(input_value, encryption_key);
            END;
            $function$;
        `);
  }
}
