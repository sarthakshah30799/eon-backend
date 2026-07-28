import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import { Country } from "../country.entity";
import { Branch } from "../../branches/branch.entity";
import { User } from "../../users/user.entity";

@Index("IDX_unblock_country_access_country_branch_user", ["countryId", "branchId", "userId"], {
  unique: true,
})
@Entity("unblock_country_access")
export class UnblockCountryAccess extends BaseEntity {
  @Column({ type: "uuid", name: "country_id" })
  countryId: string;

  @ManyToOne(() => Country, { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({
    name: "country_id",
    foreignKeyConstraintName: "FK_unblock_country_access_country_id",
  })
  country: Country;

  @Column({ type: "uuid", name: "branch_id" })
  branchId: string;

  @ManyToOne(() => Branch, { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({
    name: "branch_id",
    foreignKeyConstraintName: "FK_unblock_country_access_branch_id",
  })
  branch: Branch;

  @Column({ type: "uuid", name: "user_id" })
  userId: string;

  @ManyToOne(() => User, { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({
    name: "user_id",
    foreignKeyConstraintName: "FK_unblock_country_access_user_id",
  })
  user: User;

  @Column({ type: "boolean", name: "is_active", default: true })
  isActive: boolean;

  @Column({ type: "timestamptz", name: "revoked_at", nullable: true })
  revokedAt: Date | null;

  @Column({ type: "uuid", name: "revoked_by", nullable: true })
  revokedBy: string | null;
}
