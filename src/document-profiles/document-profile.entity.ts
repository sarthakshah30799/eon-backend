import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../base/base.entity';
import { DocumentProfileRule } from './document-profile-rule.entity';

@Entity('document_profiles')
export class DocumentProfile extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'citext' })
  profileCode: string;

  @Column({ type: 'citext' })
  profileName: string;

  @Column({ type: 'text', nullable: true })
  profileDescription: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @OneToMany(() => DocumentProfileRule, rule => rule.documentProfile, {
    cascade: ['insert', 'update'],
  })
  rules: DocumentProfileRule[];
}

