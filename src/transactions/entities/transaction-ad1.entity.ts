import {
  Column,
  Entity,
} from "typeorm";
import { BaseEntity } from "../../base/base.entity";
import {
  TransactionType,
  TransactionProfileType,
} from "../transactions.enums";

@Entity("transaction_ad1")
export class TransactionAd1 extends BaseEntity {
  // ── System / internal ─────────────────────────────────────────────────────
  @Column({ type: "varchar", length: 100, name: "number" })
  number: string;

  @Column({ type: "uuid", name: "branch_id" })
  branchId: string;

  @Column({ type: "uuid", name: "company_id", nullable: true })
  companyId: string | null;

  // ── Type / mode ───────────────────────────────────────────────────────────
  @Column({
    type: "enum",
    enum: TransactionType,
    enumName: "transactions_transaction_type_enum",
  })
  transactionType: TransactionType;

  @Column({
    type: "enum",
    enum: TransactionProfileType,
    name: "profile_type",
    nullable: true,
  })
  profileType: TransactionProfileType | null;

  // ── Form fields ───────────────────────────────────────────────────────────
  @Column({ type: "citext", name: "deal_id", nullable: true })
  dealId: string | null;

  @Column({ type: "citext", name: "doc_no", nullable: true })
  docNo: string | null;

  @Column({ type: "date", name: "transaction_date", nullable: true })
  transactionDate: Date | string | null;

  @Column({ type: "uuid", name: "marketing_id", nullable: true })
  marketingId: string | null;

  @Column({ type: "uuid", name: "segment_id", nullable: true })
  segmentId: string | null;

  @Column({ type: "citext", name: "serviced_by", nullable: true })
  servicedBy: string | null;

  @Column({ type: "uuid", name: "purpose_id", nullable: true })
  purposeId: string | null;

  @Column({ type: "citext", name: "remitter_name", nullable: true })
  remitterName: string | null;

  @Column({ type: "citext", name: "contact_no", nullable: true })
  contactNo: string | null;

  @Column({ type: "citext", name: "email", nullable: true })
  email: string | null;

  @Column({ type: "citext", name: "address", nullable: true })
  address: string | null;

  @Column({ type: "citext", name: "pan", nullable: true })
  pan: string | null;

  @Column({ type: "date", name: "date_of_birth", nullable: true })
  dateOfBirth: Date | string | null;

  @Column({ type: "uuid", name: "product_id", nullable: true })
  productId: string | null;

  @Column({ type: "citext", name: "beneficiary_name", nullable: true })
  beneficiaryName: string | null;

  @Column({ type: "citext", name: "beni_address", nullable: true })
  beniAddress: string | null;

  @Column({ type: "citext", name: "bene_account_number", nullable: true })
  beneAccountNumber: string | null;

  @Column({ type: "citext", name: "bene_bank_name", nullable: true })
  beneBankName: string | null;

  @Column({ type: "citext", name: "swift_code", nullable: true })
  swiftCode: string | null;

  @Column({ type: "uuid", name: "relationship_id", nullable: true })
  relationshipId: string | null;

  @Column({ type: "uuid", name: "currency_id", nullable: true })
  currencyId: string | null;

  @Column({ type: "numeric", name: "fc_volume", precision: 18, scale: 7, nullable: true })
  fcVolume: string | null;

  @Column({ type: "numeric", name: "sale_rate", precision: 18, scale: 7, nullable: true })
  saleRate: string | null;

  @Column({ type: "numeric", name: "total_inr_amt", precision: 18, scale: 2, nullable: true })
  totalInrAmt: string | null;

  @Column({ type: "numeric", name: "gst", precision: 18, scale: 2, nullable: true })
  gst: string | null;

  @Column({ type: "numeric", name: "bank_charges", precision: 18, scale: 2, nullable: true })
  bankCharges: string | null;

  @Column({ type: "numeric", name: "tcs", precision: 18, scale: 2, nullable: true })
  tcs: string | null;

  @Column({ type: "numeric", name: "other_income", precision: 18, scale: 2, nullable: true })
  otherIncome: string | null;

  @Column({ type: "numeric", name: "final_amount", precision: 18, scale: 2, nullable: true })
  finalAmount: string | null;

  @Column({ type: "numeric", name: "settlement_rate", precision: 18, scale: 2, nullable: true })
  settlementRate: string | null;

  @Column({ type: "numeric", name: "gross_revenue", precision: 18, scale: 2, nullable: true })
  grossRevenue: string | null;

  @Column({ type: "numeric", name: "revenue_receivable", precision: 18, scale: 2, nullable: true })
  revenueReceivable: string | null;

  @Column({ type: "uuid", name: "agent_id", nullable: true })
  agentId: string | null;

  @Column({ type: "numeric", name: "agent_comm", precision: 18, scale: 2, nullable: true })
  agentComm: string | null;

  @Column({ type: "numeric", name: "tds", precision: 18, scale: 2, nullable: true })
  tds: string | null;

  @Column({ type: "numeric", name: "commission_payable", precision: 18, scale: 2, nullable: true })
  commissionPayable: string | null;

  @Column({ type: "numeric", name: "net_revenue", precision: 18, scale: 2, nullable: true })
  netRevenue: string | null;

  @Column({ type: "uuid", name: "bank_name_id", nullable: true })
  bankNameId: string | null;

  @Column({ type: "citext", name: "rtgs_imps_neft_ref_no", nullable: true })
  rtgsImpsNeftRefNo: string | null;

  @Column({ type: "text", name: "remarks", nullable: true })
  remarks: string | null;

  // ── Snapshots (full entity JSON) ──────────────────────────────────────────
  @Column({ type: "jsonb", name: "branch_snapshot", nullable: true })
  branchSnapshot: Record<string, any> | null;

  @Column({ type: "jsonb", name: "currency_snapshot", nullable: true })
  currencySnapshot: Record<string, any> | null;

  @Column({ type: "jsonb", name: "product_snapshot", nullable: true })
  productSnapshot: Record<string, any> | null;

  @Column({ type: "jsonb", name: "agent_snapshot", nullable: true })
  agentSnapshot: Record<string, any> | null;

  @Column({ type: "jsonb", name: "bank_snapshot", nullable: true })
  bankSnapshot: Record<string, any> | null;

  @Column({ type: "jsonb", name: "marketing_snapshot", nullable: true })
  marketingSnapshot: Record<string, any> | null;

  @Column({ type: "jsonb", name: "segment_snapshot", nullable: true })
  segmentSnapshot: Record<string, any> | null;

  @Column({ type: "jsonb", name: "purpose_snapshot", nullable: true })
  purposeSnapshot: Record<string, any> | null;

  @Column({ type: "jsonb", name: "relationship_snapshot", nullable: true })
  relationshipSnapshot: Record<string, any> | null;
}
