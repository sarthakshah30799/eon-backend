import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  Index,
} from "typeorm";
import { PartyProfile } from "./party-profile.entity";
import { User } from "../users/user.entity";
import { WorkflowStatus } from "../common/enums/workflow-status.enum";

@Entity("party_profile_status_change_logs")
export class PartyProfileStatusChangeLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @ManyToOne(() => PartyProfile, { onDelete: "CASCADE" })
  @JoinColumn({
    name: "party_profile_id",
    foreignKeyConstraintName: "FK_party_profile_status_change_logs_party_profile_id",
  })
  partyProfile: PartyProfile;

  @Column({ type: "uuid", name: "party_profile_id" })
  partyProfileId: string;

  @Column({
    type: "enum",
    enum: WorkflowStatus,
  })
  status: WorkflowStatus;

  @Column({ type: "boolean", name: "active_after_review" })
  activeAfterReview: boolean;

  @Column({ type: "text", nullable: true, name: "reject_reason" })
  rejectReason?: string | null;

  @Index()
  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({
    name: "reviewed_by_id",
    foreignKeyConstraintName: "FK_party_profile_status_change_logs_reviewed_by_id",
  })
  reviewedBy: User;

  @Column({ type: "uuid", nullable: true, name: "reviewed_by_id" })
  reviewedById?: string | null;

  @CreateDateColumn({ type: "timestamptz", name: "reviewed_at" })
  reviewedAt: Date;
}
