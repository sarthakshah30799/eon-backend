// user-role.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from "typeorm";
import { User } from "../users/user.entity";
import { Role } from "../roles/role.entity";
import { Branch } from "../branches/branch.entity";
import { Counter } from "../counters/counter.entity";
import { BaseEntity } from "../base/base.entity";

@Entity("user_roles")
@Unique(["user", "role", "branch", "counter"])
export class UserRole extends BaseEntity {
  @Index()
  @ManyToOne(() => User, (user) => user.userRoles, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Index()
  @ManyToOne(() => Role, (role) => role.userRoles, { onDelete: "CASCADE" })
  @JoinColumn({ name: "role_id" })
  role: Role;

  @Index()
  @ManyToOne(() => Branch, { onDelete: "CASCADE" })
  @JoinColumn({ name: "branch_id" })
  branch: Branch;

  @Index()
  @ManyToOne(() => Counter, { onDelete: "CASCADE" })
  @JoinColumn({ name: "counter_id" })
  counter: Counter;
}
