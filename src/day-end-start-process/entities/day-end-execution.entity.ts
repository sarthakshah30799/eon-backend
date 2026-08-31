import { Column, Entity, Index } from "typeorm";
import { BaseEntity } from "../../base/base.entity";

export enum DayEndExecutionStatus {
  OPEN = "OPEN",
  BOD_COMPLETED = "BOD_COMPLETED",
  EOD_COMPLETED = "EOD_COMPLETED",
}

@Index(
  "IDX_day_end_executions_branch_business_date",
  ["branchId", "businessDate"],
  {
    unique: true,
  },
)
@Entity("day_end_executions")
export class DayEndExecution extends BaseEntity {
  @Column({ type: "uuid", name: "branch_id" })
  branchId: string;

  @Column({ type: "uuid", name: "user_id" })
  userId: string;

  @Column({ type: "date", name: "business_date" })
  businessDate: string;

  @Column({ type: "timestamptz", name: "bod_at", nullable: true })
  bodAt: Date | null;

  @Column({ type: "timestamptz", name: "eod_at", nullable: true })
  eodAt: Date | null;

  @Column({
    type: "enum",
    enum: DayEndExecutionStatus,
    default: DayEndExecutionStatus.OPEN,
  })
  status: DayEndExecutionStatus;

  @Column({ type: "jsonb", name: "checklist_snapshot", nullable: true })
  checklistSnapshot: Record<string, unknown> | null;
}
