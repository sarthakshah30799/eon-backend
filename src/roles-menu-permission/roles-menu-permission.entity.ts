// roles-menu-permission.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from "typeorm";
import { Role } from "../roles/role.entity";
import { Company } from "../company/company.entity";
import { Menu } from "../menu/menu.entity";
import { Permission } from "../permissions/permission.entity";

@Entity("roles_menu_permissions")
@Unique(["role", "company", "menu", "permission"])
export class RolesMenuPermission {
  @PrimaryGeneratedColumn("uuid") id: string;

  @Index()
  @ManyToOne(() => Role, (role) => role.menuPermissions, { onDelete: "CASCADE" })
  @JoinColumn({ name: "role_id" })
  role: Role;

  @Index()
  @ManyToOne(() => Company, (company) => company.menuPermissions, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "company_id" })
  company: Company;

  @Index()
  @ManyToOne(() => Menu, { onDelete: "CASCADE" })
  @JoinColumn({ name: "menu_id" })
  menu: Menu;

  @Index()
  @ManyToOne(() => Permission, { onDelete: "CASCADE" })
  @JoinColumn({ name: "permission_id" })
  permission: Permission;
}
