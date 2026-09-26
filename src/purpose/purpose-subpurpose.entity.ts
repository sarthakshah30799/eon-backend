import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
} from "typeorm";
import { BaseEntity } from "../base/base.entity";
import { Purpose } from "./purpose.entity";

@Entity("purpose_subpurposes")
@Unique("UQ_purpose_subpurposes_purpose_id_code", ["purposeId", "code"])
@Index("IDX_purpose_subpurposes_purpose_id", ["purposeId"])
export class PurposeSubpurpose extends BaseEntity {
  @Column({ type: "uuid", name: "purpose_id" })
  purposeId: string;

  @ManyToOne(() => Purpose, (purpose) => purpose.subpurposes, {
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "purpose_id",
    foreignKeyConstraintName: "FK_purpose_subpurposes_purpose_id",
  })
  purpose: Purpose;

  @Column({ type: "citext" })
  code: string;

  @Column({ type: "citext" })
  name: string;

  @Column({ type: "boolean", name: "is_active", default: true })
  isActive: boolean;
}
