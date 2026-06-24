import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../base/base.entity';
import { SelectOption } from '../category-options/category-option.entity';

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

  @ManyToOne(() => SelectOption, { nullable: false })
  @JoinColumn({ name: 'type', referencedColumnName: 'id' })
  type: SelectOption;

  @ManyToOne(() => SelectOption, { nullable: true })
  @JoinColumn({ name: 'group_selection', referencedColumnName: 'id' })
  groupSelection: SelectOption | null;

  @ManyToOne(() => SelectOption, { nullable: true })
  @JoinColumn({ name: 'entity_selection', referencedColumnName: 'id' })
  entitySelection: SelectOption | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;
}
