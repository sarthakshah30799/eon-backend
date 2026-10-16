import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { Branch } from "../../branches/branch.entity";
import { AccountProfile } from "../account-profile.entity";

@Entity("account_profile_branches")
@Unique("UQ_account_profile_branches_account_profile_branch", [
  "accountProfileId",
  "branchId",
])
@Index("IDX_account_profile_branches_account_profile_id", ["accountProfileId"])
@Index("IDX_account_profile_branches_branch_id", ["branchId"])
export class AccountProfileBranch extends BaseEntity {
  @Column({ name: "account_profile_id", type: "uuid" })
  accountProfileId: string;

  @ManyToOne(
    () => AccountProfile,
    (accountProfile) => accountProfile.branchLinks,
    {
      nullable: false,
      onDelete: "CASCADE",
    },
  )
  @JoinColumn({ name: "account_profile_id" })
  accountProfile: AccountProfile;

  @Column({ name: "branch_id", type: "uuid" })
  branchId: string;

  @ManyToOne(() => Branch, { nullable: false, onDelete: "RESTRICT" })
  @JoinColumn({ name: "branch_id" })
  branch: Branch;
}
