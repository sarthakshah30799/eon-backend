import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base/base.entity';
import { DocumentProfile } from './document-profile.entity';

@Entity('document_profile_rules')
export class DocumentProfileRule extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'citext' })
  documentCode: string;

  @Column({ type: 'citext' })
  documentDescription: string;

  @Column({ type: 'text', array: true, default: '{}' })
  documentType: string[];

  @Column({ type: 'boolean', default: false })
  isRequired: boolean;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  maxSizeMb: number;

  @Column({ type: 'citext', nullable: true })
  profileSelection: string | null;

  @Column({ type: 'citext', nullable: true })
  entitySelection: string | null;

  @Column({ type: 'citext', nullable: true })
  fieldSelection: string | null;

  @Column({ type: 'citext', nullable: true })
  fieldValue: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @ManyToOne(() => DocumentProfile, profile => profile.rules, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'document_profile_id',
    foreignKeyConstraintName: 'FK_document_profile_rules_document_profile_id',
  })
  documentProfile: DocumentProfile;

  @Column({ type: 'uuid', name: 'document_profile_id' })
  documentProfileId: string;
}

