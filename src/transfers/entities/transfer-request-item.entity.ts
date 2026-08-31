import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { TransferRequest } from "./transfer-request.entity";
import { TransactionReferenceSnapshotValue } from "../../transactions/types/transaction-snapshot.types";

@Index("IDX_transfer_request_items_transfer_id", ["transferId"])
@Index("IDX_transfer_request_items_transfer_line", ["transferId", "lineNo"], {
  unique: true,
})
@Entity("transfer_request_items")
export class TransferRequestItem extends BaseEntity {
  @Column({ type: "uuid", name: "transfer_id" })
  transferId: string;

  @ManyToOne(() => TransferRequest, (transfer) => transfer.items, {
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "transfer_id",
    foreignKeyConstraintName: "FK_transfer_request_items_transfer_id",
  })
  transfer: TransferRequest;

  @Column({ type: "integer", name: "line_no" })
  lineNo: number;

  @Column({ type: "uuid", name: "currency_id" })
  currencyId: string;

  @Column({ type: "jsonb", name: "currency_snapshot", nullable: true })
  currencySnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "uuid", name: "product_id" })
  productId: string;

  @Column({ type: "jsonb", name: "product_snapshot", nullable: true })
  productSnapshot: TransactionReferenceSnapshotValue;

  @Column({ type: "numeric", precision: 18, scale: 7 })
  quantity: string;

  @Column({ type: "numeric", precision: 18, scale: 7 })
  per: string;

  @Column({ type: "numeric", precision: 18, scale: 7 })
  rate: string;

  @Column({ type: "boolean", name: "rate_editable", default: false })
  rateEditable: boolean;

  @Column({ type: "numeric", precision: 18, scale: 2 })
  amount: string;

  @Column({
    type: "numeric",
    name: "round_off",
    precision: 18,
    scale: 2,
    default: 0,
  })
  roundOff: string;

  @Column({ type: "numeric", name: "final_amount", precision: 18, scale: 2 })
  finalAmount: string;

  @Column({ type: "text", nullable: true })
  remarks: string | null;
}
