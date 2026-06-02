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
  userGroupCode: string;

  @Column({ type: "citext" })
  userGroupName: string;

  @Column({ type: "boolean", default: false })
  isAdminGrp: boolean;

  @Column({ type: "boolean", default: false })
  isMdGroup: boolean;

  @Column({ type: "boolean", default: false })
  isComplianceGrp: boolean;

  @Column({ type: "boolean", default: false })
  isSrFinanceGrp: boolean;

  @Column({ type: "boolean", default: false })
  isFinanceGrp: boolean;

  @Column({ type: "boolean", default: false })
  isBrnMgrGrp: boolean;

  @Column({ type: "boolean", default: false })
  isExecutiveGrp: boolean;

  @Column({ type: "boolean", default: false })
  isCardStkGrp: boolean;

  @Column({ type: "boolean", default: false })
  isDeliveryBoyGrp: boolean;

  @Column({ type: "boolean", default: false })
  isCashierGrp: boolean;

  @Column({ type: "boolean", default: false })
  isSalesMgrGrp: boolean;

  @Column({ type: "boolean", default: true })
  isActive: boolean;

  @Column({ type: "boolean", default: false })
  isAeonAccess: boolean;

  @Column({ type: "boolean", default: false })
  isDelPortalAccess: boolean;

  @Column({ type: "boolean", default: false })
  isDelAppAccess: boolean;
}
