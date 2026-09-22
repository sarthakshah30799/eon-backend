import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { Branch } from "../../branches/branch.entity";
import { PartyProfile } from "../party-profile.entity";

@Entity("party_profile_branches")
@Unique("UQ_party_profile_branches_party_profile_branch", [
  "partyProfileId",
  "branchId",
])
@Index("IDX_party_profile_branches_party_profile_id", ["partyProfileId"])
@Index("IDX_party_profile_branches_branch_id", ["branchId"])
export class PartyProfileBranch extends BaseEntity {
  @Column({ name: "party_profile_id", type: "uuid" })
  partyProfileId: string;

  @ManyToOne(() => PartyProfile, (partyProfile) => partyProfile.branchLinks, {
    nullable: false,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "party_profile_id" })
  partyProfile: PartyProfile;

  @Column({ name: "branch_id", type: "uuid" })
  branchId: string;

  @ManyToOne(() => Branch, { nullable: false, onDelete: "RESTRICT" })
  @JoinColumn({ name: "branch_id" })
  branch: Branch;
}
