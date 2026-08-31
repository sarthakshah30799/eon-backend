import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from "typeorm";
import { BaseEntity } from "../base/base.entity";
import { Purpose } from "./purpose.entity";
import { PurposeGroup } from "./purpose-group.entity";

@Entity("purpose_group_purposes")
@Unique("UQ_purpose_group_purposes_group_purpose", [
  "purposeGroupId",
  "purposeId",
])
@Index("IDX_purpose_group_purposes_purpose_group_id", ["purposeGroupId"])
@Index("IDX_purpose_group_purposes_purpose_id", ["purposeId"])
export class PurposeGroupPurpose extends BaseEntity {
  @Column({ type: "uuid", name: "purpose_group_id" })
  purposeGroupId: string;

  @ManyToOne(() => PurposeGroup, (purposeGroup) => purposeGroup.purposes, {
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "purpose_group_id",
    foreignKeyConstraintName: "FK_purpose_group_purposes_purpose_group_id",
  })
  purposeGroup: PurposeGroup;

  @Column({ type: "uuid", name: "purpose_id" })
  purposeId: string;

  @ManyToOne(() => Purpose, (purpose) => purpose.groupLinks, {
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "purpose_id",
    foreignKeyConstraintName: "FK_purpose_group_purposes_purpose_id",
  })
  purpose: Purpose;
}
