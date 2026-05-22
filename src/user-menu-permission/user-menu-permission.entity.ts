// user-menu-permission.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from "typeorm";
import { User } from "../users/user.entity";
import { Branch } from "../branches/branch.entity";
import { Counter } from "../counters/counter.entity";
import { Menu } from "../menu/menu.entity";
import { Permission } from "../permissions/permission.entity";

@Entity("user_menu_permissions")
@Unique(["user", "branch", "counter", "menu", "permission"])
export class UserMenuPermission {
  @PrimaryGeneratedColumn("uuid") id: string;

  @Index()
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Index()
  @ManyToOne(() => Branch, { onDelete: "CASCADE" })
  @JoinColumn({ name: "branch_id" })
  branch: Branch;

  @Index()
  @ManyToOne(() => Counter, { onDelete: "CASCADE" })
  @JoinColumn({ name: "counter_id" })
  counter: Counter;

  @Index()
  @ManyToOne(() => Menu, { onDelete: "CASCADE" })
  @JoinColumn({ name: "menu_id" })
  menu: Menu;

  @Index()
  @ManyToOne(() => Permission, { onDelete: "CASCADE" })
  @JoinColumn({ name: "permission_id" })
  permission: Permission;
}
