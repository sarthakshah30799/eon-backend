import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { CreditRequestFundPrintCopyType } from "../credit-request-fund.enums";
import { CreditRequestFund } from "./credit-request-fund.entity";

@Entity("credit_request_fund_print_logs")
@Index("IDX_credit_request_fund_print_logs_header", ["creditRequestFundId"])
export class CreditRequestFundPrintLog extends BaseEntity {
  @Column({ type: "uuid", name: "credit_request_fund_id" })
  creditRequestFundId: string;

  @ManyToOne(() => CreditRequestFund, (header) => header.printLogs, {
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "credit_request_fund_id",
    foreignKeyConstraintName: "FK_credit_request_fund_print_logs_header",
  })
  creditRequestFund: CreditRequestFund;

  @Column({
    type: "enum",
    enum: CreditRequestFundPrintCopyType,
    name: "copy_type",
  })
  copyType: CreditRequestFundPrintCopyType;

  @Column({ type: "text" })
  message: string;

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
