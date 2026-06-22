import { Entity, Column, Index, ManyToOne, JoinColumn } from "typeorm";
import { BaseEntity } from "../base/base.entity";
import { State } from "../state/state.entity";
import { Branch } from "../branches/branch.entity";
import { User } from "../users/user.entity";
import { WorkflowStatus } from "../common/enums/workflow-status.enum";

export enum ClientType {
  CORPORATE_CLIENT = 'CORPORATE_CLIENT',
  FFMC = 'FFMC',
  AUTHORISED_DEALER = 'AUTHORISED_DEALER',
  RMC = 'RMC',
  FRANCHISE = 'FRANCHISE',
  AGENT = 'AGENT',
  FOREIGN_CORRESPONDENT = 'FOREIGN_CORRESPONDENT',
  MARKETING_EXECUTIVE = 'MARKETING_EXECUTIVE',
  CARD_ISSUER_PROFILE = 'CARD_ISSUER_PROFILE',
  MISC_PROFILE = 'MISC_PROFILE'
}

@Entity("party_profiles")
export class PartyProfile extends BaseEntity {
  @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
  dateOfIntro: Date;

  @Index({ unique: true })
  @Column({ type: "citext" })
  code: string;

  @Column({ type: "citext" })
  name: string;

  @Column({ type: "boolean", default: false })
  isIndividual: boolean;

  @Column({ type: "numeric", precision: 15, scale: 2, nullable: true })
  creditLimit: number;

  @Column({ type: "integer", nullable: true })
  creditDays: number;

  @Column({ type: "numeric", precision: 15, scale: 2, nullable: true })
  temporaryCreditLimit: number;

  @Column({ type: "integer", nullable: true })
  temporaryCreditDays: number;

  @Column({ type: "numeric", precision: 15, scale: 2, nullable: true })
  permanentCreditLimit: number;

  @Column({ type: "integer", nullable: true })
  permanentCreditDays: number;

  @Column({ type: "citext" })
  address1: string;

  @Column({ type: "citext", nullable: true })
  address2: string;

  @Column({ type: "citext", nullable: true })
  address3: string;

  @Column({ type: "citext" })
  city: string;

  @Column({ type: "citext" })
  pinCode: string;

  @Column({ type: "citext", nullable: true })
  kycApprovalNumber: string;

  @Column({ type: "citext", nullable: true })
  kycRiskCategory: string;

  @Column({ type: "numeric", precision: 15, scale: 2, nullable: true })
  chqTrxnLimit: number;

  @Column({ type: "numeric", precision: 15, scale: 2, nullable: true })
  defaultHandlingCharges: number;

  @Column({ type: "citext", nullable: true })
  defaultAgent: string;

  @Column({ type: "citext", nullable: true })
  phoneNo: string;

  @Column({ type: "timestamptz", nullable: true })
  blockDateFrom: Date;

  @Column({ type: "timestamptz", nullable: true })
  establishmentDate: Date;

  @Column({ type: "text", nullable: true })
  remarks: string;

  @Column({ type: "citext", nullable: true })
  email: string;

  @Column({ type: "citext", nullable: true })
  contactName: string;

  @Column({ type: "citext", nullable: true })
  designation: string;

  @Column({ type: "citext", nullable: true })
  group: string;

  @Column({ type: "citext", nullable: true })
  entityType: string;

  @Column({ type: "citext", nullable: true })
  panName: string;

  @Column({ type: "timestamptz", nullable: true })
  panDob: Date;

  @Column({ type: "citext", nullable: true })
  panNo: string;

  @Column({ type: "citext", nullable: true })
  marketingExecutive: string;

  @Column({ type: "citext", nullable: true })
  businessNature: string;

  @Column({ type: "boolean", default: false })
  isTdsDeducted: boolean;

  @Column({ type: "citext", nullable: true })
  tds: string;

  @Column({ type: "citext", nullable: true })
  tdsGroup: string;

  @Column({ type: "boolean", default: false })
  active: boolean;

  @Column({ type: "boolean", default: false })
  isActive: boolean;

  @Column({
    type: "enum",
    enum: WorkflowStatus,
    default: WorkflowStatus.PENDING,
  })
  status: WorkflowStatus;

  @ManyToOne(() => User, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({
    name: "status_updated_by_id",
    foreignKeyConstraintName: "FK_party_profiles_status_updated_by_id",
  })
  statusUpdatedBy: User;

  @Column({ type: "uuid", nullable: true, name: "status_updated_by_id" })
  statusUpdatedById: string | null;

  @Column({ type: "timestamptz", nullable: true, name: "status_updated_at" })
  statusUpdatedAt: Date | null;

  @Column({ type: "boolean", default: false })
  printAddress: boolean;

  @Column({ type: "boolean", default: false })
  eefcClient: boolean;

  @Column({ type: "boolean", default: false })
  sale: boolean;

  @Column({ type: "boolean", default: false })
  purchase: boolean;

  @Column({ type: "boolean", default: false })
  applyTax: boolean;

  @Column({ type: "boolean", default: false })
  igstOnly: boolean;

  @Column({ type: "citext", nullable: true })
  gstNo: string;

  @Column({ type: "citext", nullable: true })
  sgstNo: string;

  @Column({ type: "citext", nullable: true })
  igstNo: string;

  @ManyToOne(() => State, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({
    name: "gst_state_id",
    foreignKeyConstraintName: "FK_party_profiles_gst_state_id",
  })
  gstState: State;

  @Column({ type: "uuid", nullable: true })
  gstStateId: string;

  @ManyToOne(() => Branch, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({
    name: "origin_branch_id",
    foreignKeyConstraintName: "FK_party_profiles_origin_branch_id",
  })
  originBranch: Branch;

  @Column({ type: "uuid", nullable: true })
  originBranchId: string;

  @Column({ type: "citext", nullable: true })
  location: string;

  @Column({ type: "citext", nullable: true })
  webSite: string;

  @Column({ type: "citext", nullable: true })
  accountHolderName: string;

  @Column({ type: "citext", nullable: true })
  bankName: string;

  @Column({ type: "citext", nullable: true })
  accountNumber: string;

  @Column({ type: "citext", nullable: true })
  ifscCode: string;

  @Column({ type: "text", nullable: true })
  bankAddress: string;

  @Column({ type: "text", nullable: true })
  cancelledChequeCopy: string;

  @Column({
    type: "enum",
    enum: ClientType,
    default: ClientType.CORPORATE_CLIENT,
  })
  type: ClientType;

  // ── FFMC-specific fields ──────────────────────────────────────────────────
  @Column({ type: "citext", nullable: true })
  ffmcRegNo: string;

  @Column({ type: "timestamptz", nullable: true })
  ffmcRegDate: Date;
}
