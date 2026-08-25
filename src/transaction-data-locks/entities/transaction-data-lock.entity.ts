import { Column, Entity, Index } from "typeorm";
import { BaseEntity } from "../../base/base.entity";

@Index("UQ_transaction_data_locks_branch_id", ["branchId"], { unique: true })
@Entity("transaction_data_locks")
export class TransactionDataLock extends BaseEntity {
  @Column({ type: "uuid", name: "branch_id" })
  branchId: string;

  @Column({ type: "date", name: "locked_through_date" })
  lockedThroughDate: string;

  @Column({ type: "timestamptz", name: "locked_at" })
  lockedAt: Date;

  @Column({ type: "uuid", name: "locked_by" })
  lockedBy: string;

  @Column({ type: "date", name: "report_start_date", nullable: true })
  reportStartDate: string | null;

  @Column({ type: "date", name: "report_end_date", nullable: true })
  reportEndDate: string | null;
}
