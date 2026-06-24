import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../base/base.entity';

export enum DocumentSpecificationType {
  MASTER = 'MASTER',
  TRANSACTION = 'TRANSACTION',
}

@Entity('document_profiles')
export class DocumentProfile extends BaseEntity {
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

  @Column({ type: 'enum', enum: DocumentSpecificationType })
  specificationType: DocumentSpecificationType;

  @Column({ type: 'uuid' })
  type: string;

  @Column({ type: 'uuid', nullable: true })
  groupSelection: string | null;

  @Column({ type: 'uuid', nullable: true })
  entitySelection: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;
}
