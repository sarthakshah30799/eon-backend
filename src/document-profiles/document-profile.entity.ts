import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../base/base.entity';
import { DocumentProfileRule } from './document-profile-rule.entity';

@Entity('document_profiles')
export class DocumentProfile extends BaseEntity {
  @Column({ type: 'citext' })
  specificationType: string;

  @Column({ type: 'citext' })
  type: string;

  @Column({ type: 'citext', nullable: true })
  groupSelection: string | null;

  @Column({ type: 'citext', nullable: true })
  entitySelection: string | null;

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
