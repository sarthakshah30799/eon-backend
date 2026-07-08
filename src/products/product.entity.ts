import { Entity, Column, Index, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseEntity } from '../base/base.entity';
import { ProductCurrencyRate } from '../currency-rates/product-currency-rate.entity';
import { AccountProfile } from '../account-profiles/account-profile.entity';

@Entity('products')
export class Product extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'citext', unique: true, nullable: false })
  productCode: string;

  @Column({ type: 'citext', nullable: false })
  productDescription: string;

  // Accounting Configuration
  @ManyToOne(() => AccountProfile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ac_of_issuer_id' })
  acOfIssuer: AccountProfile | null;

  @ManyToOne(() => AccountProfile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'commission_ac_id' })
  commissionAc: AccountProfile | null;

  @ManyToOne(() => AccountProfile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'fake_account_id' })
  fakeAccount: AccountProfile | null;

  @ManyToOne(() => AccountProfile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'bulk_pur_ac_id' })
  bulkPurAc: AccountProfile | null;

  @ManyToOne(() => AccountProfile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'open_ac_id' })
  openAc: AccountProfile | null;

  @ManyToOne(() => AccountProfile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'closing_ac_id' })
  closingAc: AccountProfile | null;

  @ManyToOne(() => AccountProfile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'expense_ac_id' })
  expenseAc: AccountProfile | null;

  @ManyToOne(() => AccountProfile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'bulk_sale_ac_id' })
  bulkSaleAc: AccountProfile | null;

  @ManyToOne(() => AccountProfile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'purchase_ac_id' })
  purchaseAc: AccountProfile | null;

  @ManyToOne(() => AccountProfile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sale_ac_id' })
  saleAc: AccountProfile | null;

  @ManyToOne(() => AccountProfile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'profit_ac_id' })
  profitAc: AccountProfile | null;

  @ManyToOne(() => AccountProfile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'bulk_profic_ac_id' })
  bulkProficAc: AccountProfile | null;

  @ManyToOne(() => AccountProfile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'purchase_ret_canc_ac_id' })
  purchaseRetCancAc: AccountProfile | null;

  @ManyToOne(() => AccountProfile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'purchase_blk_canc_ac_id' })
  purchaseBlkCancAc: AccountProfile | null;

  @ManyToOne(() => AccountProfile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sale_ret_canc_ac_id' })
  saleRetCancAc: AccountProfile | null;

  @ManyToOne(() => AccountProfile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sale_blk_canc_ac_id' })
  saleBlkCancAc: AccountProfile | null;

  @ManyToOne(() => AccountProfile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'branch_pur_ac_id' })
  branchPurAc: AccountProfile | null;

  @ManyToOne(() => AccountProfile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'branch_sale_ac_id' })
  branchSaleAc: AccountProfile | null;

  @ManyToOne(() => AccountProfile, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'profit_ac_brn_sale_id' })
  profitAcBrnSale: AccountProfile | null;

  // Additional Fields from Frontend
  @Column({ type: 'citext', nullable: true })
  retail: string;

  @Column({ type: 'citext', nullable: true })
  bulkFee: string;

  @Column({ type: 'citext', nullable: true })
  commLimit: string;

  @Column({ type: 'citext', nullable: true })
  maxAmtComm: string;

  @Column({ type: 'boolean', default: false })
  allowFractionInFEAmount: boolean;

  @Column({ type: 'boolean', default: false })
  separateSettlementForEachInstrument: boolean;

  @Column({ type: 'boolean', default: false })
  pickSaleRateAvgAsSettlementRate: boolean;

  @Column({ type: 'boolean', default: false })
  reload: boolean;

  @Column({ type: 'boolean', default: false })
  automateSettlementRate: boolean;

  @Column({ type: 'boolean', default: false })
  isActiveProduct: boolean;

  @Column({ type: 'boolean', default: false })
  splitAndStoreBlankStockReceived: boolean;

  @Column({ type: 'boolean', default: false })
  productRequiresSettlement: boolean;

  @Column({ type: 'citext', nullable: true })
  levelPriority: string;

  @Column({ type: 'boolean', default: false })
  passAutoReceiptOfStockWhenSold: boolean;

  @Column({ type: 'boolean', default: false })
  reversalEffectOfProfits: boolean;

  @Column({ type: 'boolean', default: false })
  allowChangingDenominationInSales: boolean;

  @Column({ type: 'boolean', default: false })
  allowMulticard: boolean;

  @Column({ type: 'boolean', default: false })
  askReference: boolean;

  // Transaction configurations and rules
  @Column({ type: 'boolean', default: false })
  availableInRetailBuying: boolean;

  @Column({ type: 'boolean', default: false })
  retailBuyingSeriesApplicable: boolean;

  @Column({ type: 'boolean', default: false })
  availableInRetailSelling: boolean;

  @Column({ type: 'boolean', default: false })
  retailSellingSeriesApplicable: boolean;

  @Column({ type: 'boolean', default: false })
  availableInBulkBuying: boolean;

  @Column({ type: 'boolean', default: false })
  bulkBuyingSeriesApplicable: boolean;

  @Column({ type: 'boolean', default: false })
  availableInBulkSelling: boolean;

  @Column({ type: 'boolean', default: false })
  bulkSellingSeriesApplicable: boolean;

  @Column({ type: 'boolean', default: false })
  allowProductCancellation: boolean;

  @Column({ type: 'boolean', default: false })
  maintainBlankStockOfProduct: boolean;

  @Column({ type: 'boolean', default: false })
  denominationApplicable: boolean;

  @Column({ type: 'boolean', default: false })
  allowAddOnLinking: boolean;

  @Column({ type: 'boolean', default: false })
  instrumentIssuingAuthorityRequired: boolean;

  @OneToMany(() => ProductCurrencyRate, rate => rate.product)
  currencyRates: ProductCurrencyRate[];
}
