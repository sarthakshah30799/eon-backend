import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { DayEndEventStatus } from "../day-end-process.enums";
import { DayEndExecution } from "./day-end-execution.entity";

@Index("IDX_day_end_events_day_end_execution_id", ["dayEndExecutionId"])
@Index("IDX_day_end_events_status_available_at", ["status", "availableAt"])
@Index("IDX_day_end_events_branch_business_date_event_type", [
  "branchId",
  "businessDate",
  "eventType",
])
@Entity("day_end_events")
export class DayEndEvent extends BaseEntity {
  @Column({ type: "uuid", name: "day_end_execution_id" })
  dayEndExecutionId: string;

  @ManyToOne(() => DayEndExecution, { onDelete: "CASCADE" })
  @JoinColumn({
    name: "day_end_execution_id",
    foreignKeyConstraintName: "FK_day_end_events_day_end_execution_id",
  })
  dayEndExecution: DayEndExecution;

  @Column({ type: "uuid", name: "branch_id" })
  branchId: string;

  @Column({ type: "date", name: "business_date" })
  businessDate: string;

  @Column({ type: "citext", name: "event_type" })
  eventType: string;

  @Column({ type: "jsonb", nullable: false })
  payload: Record<string, unknown>;

  @Column({
    type: "enum",
    enum: DayEndEventStatus,
    default: DayEndEventStatus.PENDING,
  })
  status: DayEndEventStatus;

  @Column({ type: "integer", name: "attempt_count", default: 0 })
  attemptCount: number;

  @Column({ type: "timestamptz", name: "available_at", default: () => "now()" })
  availableAt: Date;

  @Column({ type: "timestamptz", name: "processed_at", nullable: true })
  processedAt: Date | null;

  @Column({ type: "text", name: "error_message", nullable: true })
  errorMessage: string | null;

  @Column({ type: "timestamptz", name: "locked_at", nullable: true })
  lockedAt: Date | null;

  @Column({ type: "uuid", name: "locked_by_id", nullable: true })
  lockedById: string | null;
}
