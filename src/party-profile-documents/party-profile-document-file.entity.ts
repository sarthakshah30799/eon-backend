import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '../base/base.entity';
import { PartyProfileDocument } from './party-profile-document.entity';

@Entity('party_profile_document_files')
export class PartyProfileDocumentFile extends BaseEntity {
  @OneToOne(
    () => PartyProfileDocument,
    document => document.documentFile,
    {
      nullable: false,
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({
    name: 'party_profile_document_id',
    foreignKeyConstraintName:
      'FK_party_profile_document_files_party_profile_document_id',
  })
  partyProfileDocument: PartyProfileDocument;

  @Column({ type: 'uuid', name: 'party_profile_document_id', unique: true })
  partyProfileDocumentId: string;

  @Column({ type: 'citext' })
  fileName: string;

  @Column({ type: 'citext' })
  mimeType: string;

  @Column({ type: 'int' })
  sizeBytes: number;

  @Column({ type: 'bytea' })
  content: Buffer;
}
