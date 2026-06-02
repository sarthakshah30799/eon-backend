import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../base/base.entity';
import { Branch } from '../branches/branch.entity';
import { RolesMenuPermission } from '../roles-menu-permission/roles-menu-permission.entity';

@Entity('company')
export class Company extends BaseEntity {
  @OneToMany(() => Branch, (branch) => branch.company)
  branches: Branch[];

  @OneToMany(
    () => RolesMenuPermission,
    (menuPermission) => menuPermission.company
  )
  menuPermissions: RolesMenuPermission[];

  @Column({ type: 'citext', nullable: true })
  shortCode: string;

  @Column({ type: 'citext' })
  name: string;

  @Column({ type: 'citext', nullable: true })
  formerlyKnownName: string;

  @Column({ type: 'citext', nullable: true })
  cinNo: string;

  @Column({ type: 'citext', nullable: false, unique: true })
  panNo: string;

  @Column({ type: 'citext', nullable: true })
  fxRegNo: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  fxRegDate: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  fromDate: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  toDate: Date;

  @Column({ type: 'text', nullable: true })
  logo: string;

  @Column({ type: 'citext', nullable: true })
  aeonLicNo: string;

  @Column({ type: 'citext', nullable: true })
  website: string;

  @Column({ type: 'citext', nullable: true })
  email: string;
}
