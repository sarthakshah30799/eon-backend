import { Column, Entity, Index } from "typeorm";
import { BaseEntity } from "../../base/base.entity";

@Index("IDX_monthly_lock_windows_branch_user", ["branchId", "userId"])
@Entity("monthly_lock_windows")
export class MonthlyLockWindow extends BaseEntity {
  @Column({ type: "uuid", name: "branch_id" })
  branchId: string;

  @Column({ type: "uuid", name: "user_id" })
  userId: string;

  @Column({ type: "date", name: "from_date" })
  fromDate: string;

  @Column({ type: "date", name: "to_date" })
  toDate: string;

  @Column({ type: "boolean", name: "is_active", default: true })
  isActive: boolean;

  @Column({ type: "timestamptz", name: "revoked_at", nullable: true })
  revokedAt: Date | null;

  @Column({ type: "uuid", name: "revoked_by", nullable: true })
  revokedBy: string | null;
}
