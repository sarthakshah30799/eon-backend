// role.entity.ts
import { Entity, Column, OneToMany } from "typeorm";
import { BaseEntity } from "../base/base.entity";
import { RolesMenuPermission } from "../roles-menu-permission/roles-menu-permission.entity";
import { UserRole } from "../user-roles/user-role.entity";

@Entity("roles")
export class Role extends BaseEntity {
  @OneToMany(() => RolesMenuPermission, (menuPermission) => menuPermission.role)
  menuPermissions: RolesMenuPermission[];

  @OneToMany(() => UserRole, (userRole) => userRole.role)
  userRoles: UserRole[];

  @Column({ type: "citext", unique: true })
  code: string;

  @Column({ type: "citext" })
  name: string;

  @Column({ type: "boolean", default: false })
  isAdmin: boolean;

  @Column({ type: "boolean", default: false })
  isMd: boolean;

  @Column({ type: "boolean", default: false })
  isCompliance: boolean;

  @Column({ type: "boolean", default: false })
  isSrFinance: boolean;

  @Column({ type: "boolean", default: false })
  isFinance: boolean;

  @Column({ type: "boolean", default: false })
  isBrnMgr: boolean;

  @Column({ type: "boolean", default: false })
  isHoStaff: boolean;

  @Column({ type: "boolean", default: false })
  isExecutive: boolean;

  @Column({ type: "boolean", default: false })
  isCardStk: boolean;

  @Column({ type: "boolean", default: false })
  isDeliveryBoy: boolean;

  @Column({ type: "boolean", default: false })
  isCashier: boolean;

  @Column({ type: "boolean", default: false })
  isSalesMgr: boolean;

  @Column({ type: "boolean", default: true })
  isActive: boolean;

  @Column({ type: "boolean", default: false })
  isAeonAccess: boolean;

  @Column({ type: "boolean", default: false })
  isDelPortalAccess: boolean;

  @Column({ type: "boolean", default: false })
  isDelAppAccess: boolean;
}
