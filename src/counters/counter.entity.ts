// counter.entity.ts
import { Entity, Column, Index, ManyToOne, JoinColumn, OneToMany } from "typeorm";
import { BaseEntity } from "../base/base.entity";
import { Branch } from "../branches/branch.entity";
import { UserRole } from "../user-roles/user-role.entity";

@Entity("counters")
export class Counter extends BaseEntity {
  @OneToMany(() => UserRole, (userRole) => userRole.counter)
  userRoles: UserRole[];

  @Index()
  @ManyToOne(() => Branch, (branch) => branch.counters, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "branch_id" })
  branch: Branch;

  @Column({ type: "integer", default: 1 })
  counterNo: number;

  @Column({ type: "citext" })
  counterName: string;

  @Column({ type: "boolean", default: true })
  isActive: boolean;

  @Column({ type: "boolean", default: false })
  isRetailCnt: boolean;

  @Column({ type: "boolean", default: false })
  isBulkCnt: boolean;

  @Column({ type: "boolean", default: false })
  isCombineCnt: boolean;
}
