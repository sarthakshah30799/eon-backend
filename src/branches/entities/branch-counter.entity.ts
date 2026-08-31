import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { Branch } from "../branch.entity";
import { Counter } from "../../counters/counter.entity";

@Entity("branch_counters")
@Unique("UQ_branch_counters_branch_counter", ["branchId", "counterId"])
@Index("IDX_branch_counters_branch_id", ["branchId"])
@Index("IDX_branch_counters_counter_id", ["counterId"])
export class BranchCounter extends BaseEntity {
  @Column({ name: "branch_id", type: "uuid" })
  branchId: string;

  @ManyToOne(() => Branch, (branch) => branch.counterLinks, {
    nullable: false,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "branch_id" })
  branch: Branch;

  @Column({ name: "counter_id", type: "uuid" })
  counterId: string;

  @ManyToOne(() => Counter, (counter) => counter.branchLinks, {
    nullable: false,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "counter_id" })
  counter: Counter;
}
