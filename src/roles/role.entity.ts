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

  @Column({ type: "citext" })
  name: string;

  @Column({ type: "citext", unique: true })
  code: string;

  @Column({ type: "text", nullable: true })
  description: string;
}
