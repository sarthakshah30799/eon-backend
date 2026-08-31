import { Entity, Index, JoinColumn, ManyToOne, Column } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { CardStockCard } from "./card-stock-card.entity";
import { CardTransferRequest } from "./card-transfer-request.entity";
import { CardTransferRequestItem } from "./card-transfer-request-item.entity";

@Index(
  "IDX_card_transfer_request_cards_transfer_card",
  ["transferId", "cardId"],
  {
    unique: true,
  },
)
@Index(
  "IDX_card_transfer_request_cards_item_card",
  ["transferItemId", "cardId"],
  {
    unique: true,
  },
)
@Index("IDX_card_transfer_request_cards_card", ["cardId"])
@Entity("card_transfer_request_cards")
export class CardTransferRequestCard extends BaseEntity {
  @Column({ type: "uuid", name: "transfer_id" })
  transferId: string;

  @ManyToOne(() => CardTransferRequest, (transfer) => transfer.selectedCards, {
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "transfer_id",
    foreignKeyConstraintName: "FK_card_transfer_request_cards_transfer",
  })
  transfer: CardTransferRequest;

  @Column({ type: "uuid", name: "transfer_item_id" })
  transferItemId: string;

  @ManyToOne(() => CardTransferRequestItem, (item) => item.selectedCards, {
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "transfer_item_id",
    foreignKeyConstraintName: "FK_card_transfer_request_cards_item",
  })
  transferItem: CardTransferRequestItem;

  @Column({ type: "uuid", name: "card_id" })
  cardId: string;

  @ManyToOne(() => CardStockCard, (card) => card.transferSelections, {
    onDelete: "RESTRICT",
  })
  @JoinColumn({
    name: "card_id",
    foreignKeyConstraintName: "FK_card_transfer_request_cards_card",
  })
  card: CardStockCard;
}
