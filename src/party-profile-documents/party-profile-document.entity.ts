import { Column, Entity, Index, JoinColumn, ManyToOne, OneToOne } from 'typeorm';
import { BaseEntity } from '../base/base.entity';
import { PartyProfile } from '../party-profiles/party-profile.entity';
import { DocumentProfile } from '../document-profiles/document-profile.entity';
import { DocumentProfileRule } from '../document-profiles/document-profile-rule.entity';
import { PartyProfileDocumentFile } from './party-profile-document-file.entity';

@Entity('party_profile_documents')
@Index(['partyProfileId', 'documentProfileRuleId'], { unique: true })
export class PartyProfileDocument extends BaseEntity {
  @ManyToOne(() => PartyProfile, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'party_profile_id',
    foreignKeyConstraintName: 'FK_party_profile_documents_party_profile_id',
  })
  partyProfile: PartyProfile;

  @Column({ type: 'uuid', name: 'party_profile_id' })
  partyProfileId: string;

  @ManyToOne(() => DocumentProfile, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'document_profile_id',
    foreignKeyConstraintName: 'FK_party_profile_documents_document_profile_id',
  })
  documentProfile: DocumentProfile;

  @Column({ type: 'uuid', name: 'document_profile_id' })
  documentProfileId: string;

  @ManyToOne(() => DocumentProfileRule, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'document_profile_rule_id',
    foreignKeyConstraintName:
      'FK_party_profile_documents_document_profile_rule_id',
  })
  documentProfileRule: DocumentProfileRule;

  @Column({ type: 'uuid', name: 'document_profile_rule_id' })
  documentProfileRuleId: string;

  @OneToOne(() => PartyProfileDocumentFile, file => file.partyProfileDocument, {
    cascade: ['insert', 'update'],
  })
  documentFile: PartyProfileDocumentFile | null;
}
