import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../base/base.entity';
import { PurposeGroupPurpose } from './purpose-group-purpose.entity';
import { PurposeGroupProfileType } from './purpose.enums';

@Entity('purpose_groups')
@Index('UQ_purpose_groups_profile_type_name', ['profileType', 'name'], {
  unique: true,
})
export class PurposeGroup extends BaseEntity {
  @Column({ type: 'citext' })
  name: string;

  @Column({ type: 'citext' })
  title: string;

  @Column({
    type: 'enum',
    enum: PurposeGroupProfileType,
    enumName: 'purpose_groups_profile_type_enum',
    name: 'profile_type',
  })
  profileType: PurposeGroupProfileType;

  @Column({ type: 'int', name: 'sort_order', default: 0 })
  sortOrder: number;

  @OneToMany(() => PurposeGroupPurpose, link => link.purposeGroup, {
    cascade: true,
  })
  purposes: PurposeGroupPurpose[];
}
