import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { CreditRequestFundLogAction } from "../credit-request-fund.enums";
import { CreditRequestFund } from "./credit-request-fund.entity";

@Index("IDX_credit_request_fund_logs_header_id", ["creditRequestFundId"])
@Entity("credit_request_fund_logs")
export class CreditRequestFundLog extends BaseEntity {
  @Column({ type: "uuid", name: "credit_request_fund_id" })
  creditRequestFundId: string;

  @ManyToOne(() => CreditRequestFund, (header) => header.logs, {
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "credit_request_fund_id",
    foreignKeyConstraintName: "FK_credit_request_fund_logs_header",
  })
  creditRequestFund: CreditRequestFund;

  @Column({
    type: "enum",
    enum: CreditRequestFundLogAction,
    enumName: "credit_request_fund_logs_action_enum",
  })
  action: CreditRequestFundLogAction;

  @Column({ type: "text" })
  message: string;

  @Column({ type: "jsonb", name: "before_snapshot", nullable: true })
  beforeSnapshot: Record<string, unknown> | null;

  @Column({ type: "jsonb", name: "after_snapshot", nullable: true })
  afterSnapshot: Record<string, unknown> | null;

  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: "uuid", name: "performed_by_id", nullable: true })
  performedById: string | null;

  @Column({ type: "citext", name: "performed_by_name", nullable: true })
  performedByName: string | null;

  @Column({
    type: "timestamptz",
    name: "performed_at",
    default: () => "now()",
  })
  performedAt: Date;
}
