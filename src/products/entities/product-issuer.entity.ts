import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { PartyProfile } from "../../party-profiles/party-profile.entity";
import { Product } from "../product.entity";

@Entity("product_issuers")
@Unique("UQ_product_issuers_product_party_profile", [
  "productId",
  "partyProfileId",
])
@Index("IDX_product_issuers_product_id", ["productId"])
@Index("IDX_product_issuers_party_profile_id", ["partyProfileId"])
export class ProductIssuer extends BaseEntity {
  @Column({ name: "product_id", type: "uuid" })
  productId: string;

  @ManyToOne(() => Product, (product) => product.issuerLinks, {
    nullable: false,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "product_id" })
  product: Product;

  @Column({ name: "party_profile_id", type: "uuid" })
  partyProfileId: string;

  @ManyToOne(
    () => PartyProfile,
    (partyProfile) => partyProfile.productIssuerLinks,
    { nullable: false, onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "party_profile_id" })
  partyProfile: PartyProfile;
}
