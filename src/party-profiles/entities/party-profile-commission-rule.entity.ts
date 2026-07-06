import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { PartyProfile } from "../party-profile.entity";
import {
  PartyProfileCommissionTypeEnum,
  type PartyProfileCommissionType,
} from "../types/party-profile-commission-rule.types";

@Index(
  "IDX_party_profile_commission_rules_party_currency_product",
  ["partyProfileId", "currencyCode", "productCode"],
  { unique: true },
)
@Index("IDX_party_profile_commission_rules_party_profile_id", ["partyProfileId"])
@Entity("party_profile_commission_rules")
export class PartyProfileCommissionRule extends BaseEntity {
  @Column({ type: "uuid", name: "party_profile_id" })
  partyProfileId: string;

  @ManyToOne(() => PartyProfile, profile => profile.commissionRules, {
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "party_profile_id",
    foreignKeyConstraintName: "FK_party_profile_commission_rules_party_profile_id",
  })
  partyProfile: PartyProfile;

  @Column({ type: "citext", name: "currency_code" })
  currencyCode: string;

  @Column({ type: "citext", name: "currency_name", nullable: true })
  currencyName: string | null;

  @Column({ type: "citext", name: "product_code" })
  productCode: string;

  @Column({ type: "citext", name: "product_description", nullable: true })
  productDescription: string | null;

  @Column({
    type: "enum",
    enum: PartyProfileCommissionTypeEnum,
    enumName: "party_profile_commission_rules_type_enum",
  })
  commissionType: PartyProfileCommissionType;

  @Column({ type: "numeric", name: "commission_value", precision: 18, scale: 4 })
  commissionValue: string;
}
