import { Column, Entity, Index, OneToMany } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { AdvanceAdjustmentStatus } from "../advance-adjustment.enums";
import { AdvanceAdjustmentItem } from "./advance-adjustment-item.entity";

@Entity("advance_adjustment")
@Index("UQ_advance_adjustment_number", ["number"], { unique: true })
@Index("IDX_advance_adjustment_branch_date", ["branchId", "transactionDate"])
@Index("IDX_advance_adjustment_party", ["partyProfileId"])
@Index("IDX_advance_adjustment_status", ["status"])
export class AdvanceAdjustment extends BaseEntity {
  @Column({ type: "citext" })
  number: string;

  @Column({ type: "uuid", name: "branch_id" })
  branchId: string;

  @Column({ type: "jsonb", name: "branch_snapshot" })
  branchSnapshot: Record<string, any>;

  @Column({ type: "uuid", name: "counter_id" })
  counterId: string;

  @Column({ type: "jsonb", name: "counter_snapshot" })
  counterSnapshot: Record<string, any>;

  @Column({ type: "date", name: "transaction_date" })
  transactionDate: string;

  @Column({ type: "date", name: "as_on_date" })
  asOnDate: string;

  @Column({ type: "uuid", name: "party_profile_id" })
  partyProfileId: string;

  @Column({ type: "jsonb", name: "party_profile_snapshot" })
  partyProfileSnapshot: Record<string, any>;

  @Column({ type: "citext", nullable: true, name: "pan_number" })
  panNumber: string | null;

  @Column({ type: "citext", nullable: true, name: "pan_name" })
  panName: string | null;

  @Column({ type: "date", nullable: true, name: "pan_dob" })
  panDob: string | null;

  @Column({
    type: "enum",
    enum: AdvanceAdjustmentStatus,
    default: AdvanceAdjustmentStatus.DRAFT,
  })
  status: AdvanceAdjustmentStatus;

  @Column({
    type: "numeric",
    precision: 18,
    scale: 2,
    name: "total_adjustment_amount",
  })
  totalAdjustmentAmount: string;

  @Column({ type: "text" })
  narration: string;

  @OneToMany(() => AdvanceAdjustmentItem, (item) => item.advanceAdjustment, {
    cascade: true,
  })
  items: AdvanceAdjustmentItem[];
}
