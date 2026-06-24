import { MigrationInterface, QueryRunner } from "typeorm";

export class PartyProfileDocuments1782248142807 implements MigrationInterface {
    name = 'PartyProfileDocuments1782248142807'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "party_profile_document_files" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "party_profile_document_id" uuid NOT NULL, "file_name" citext NOT NULL, "mime_type" citext NOT NULL, "size_bytes" integer NOT NULL, "content" bytea NOT NULL, CONSTRAINT "UQ_c5d1f5f2657ab1ce6a6bbb7fc51" UNIQUE ("party_profile_document_id"), CONSTRAINT "REL_c5d1f5f2657ab1ce6a6bbb7fc5" UNIQUE ("party_profile_document_id"), CONSTRAINT "PK_cebcd568552ccb3a01ecfd84697" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "party_profile_documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "created_by" uuid NOT NULL, "updated_by" uuid NOT NULL, "party_profile_id" uuid NOT NULL, "document_profile_id" uuid NOT NULL, "document_profile_rule_id" uuid NOT NULL, CONSTRAINT "PK_f00a861f759f2a19da4000ba68f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_a874a3baf37bbe03a36459ac62" ON "party_profile_documents" ("party_profile_id", "document_profile_rule_id") `);
        await queryRunner.query(`ALTER TABLE "party_profile_document_files" ADD CONSTRAINT "FK_party_profile_document_files_party_profile_document_id" FOREIGN KEY ("party_profile_document_id") REFERENCES "party_profile_documents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "party_profile_documents" ADD CONSTRAINT "FK_party_profile_documents_party_profile_id" FOREIGN KEY ("party_profile_id") REFERENCES "party_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "party_profile_documents" ADD CONSTRAINT "FK_party_profile_documents_document_profile_id" FOREIGN KEY ("document_profile_id") REFERENCES "document_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "party_profile_documents" ADD CONSTRAINT "FK_party_profile_documents_document_profile_rule_id" FOREIGN KEY ("document_profile_rule_id") REFERENCES "document_profile_rules"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "party_profile_documents" DROP CONSTRAINT "FK_party_profile_documents_document_profile_rule_id"`);
        await queryRunner.query(`ALTER TABLE "party_profile_documents" DROP CONSTRAINT "FK_party_profile_documents_document_profile_id"`);
        await queryRunner.query(`ALTER TABLE "party_profile_documents" DROP CONSTRAINT "FK_party_profile_documents_party_profile_id"`);
        await queryRunner.query(`ALTER TABLE "party_profile_document_files" DROP CONSTRAINT "FK_party_profile_document_files_party_profile_document_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a874a3baf37bbe03a36459ac62"`);
        await queryRunner.query(`DROP TABLE "party_profile_documents"`);
        await queryRunner.query(`DROP TABLE "party_profile_document_files"`);
    }

}
