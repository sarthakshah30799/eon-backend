// counter.entity.ts
import { Entity, Column, Index, ManyToOne, JoinColumn, OneToMany } from "typeorm";
import { BaseEntity } from "../base/base.entity";
import { Branch } from "../branches/branch.entity";
import { UserRole } from "../user-roles/user-role.entity";

export enum CounterStatus {
  PENDING = "pending",
  ACTIVE = "active",
  INACTIVE = "inactive",
}

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

  @Column({ type: "citext", unique: true })
  counterCode: string;

  @Column({ type: "citext" })
  name: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "text", nullable: true })
  remark: string;

  @Index()
  @Column({ type: "enum", enum: CounterStatus, default: CounterStatus.PENDING })
  status: CounterStatus;
}
