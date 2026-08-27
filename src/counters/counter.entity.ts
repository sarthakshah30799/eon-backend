// counter.entity.ts
import { Entity, Column, OneToMany } from "typeorm";
import { BaseEntity } from "../base/base.entity";
import { UserRole } from "../user-roles/user-role.entity";
import { BranchCounter } from "../branches/entities/branch-counter.entity";

@Entity("counters")
export class Counter extends BaseEntity {
  @OneToMany(() => UserRole, (userRole) => userRole.counter)
  userRoles: UserRole[];

  @OneToMany(() => BranchCounter, (branchLink) => branchLink.counter)
  branchLinks: BranchCounter[];

  @Column({ type: "integer", default: 1 })
  counterNo: number;

  @Column({ type: "citext" })
  name: string;

  @Column({ type: "boolean", default: true })
  isActive: boolean;

  @Column({ type: "boolean", default: false })
  isRetail: boolean;

  @Column({ type: "boolean", default: false })
  isBulk: boolean;

  @Column({ type: "boolean", default: false })
  isCombine: boolean;
}
