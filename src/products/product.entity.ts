import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../base/base.entity';

@Entity('products')
export class Product extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'citext', unique: true, nullable: false })
  productCode: string;

  @Column({ type: 'citext', nullable: false })
  productDescription: string;

  // Accounting Configuration
  @Column({ type: 'citext', nullable: true })
  acOfIssuer: string;

  @Column({ type: 'citext', nullable: true })
  commissionAc: string;

  @Column({ type: 'citext', nullable: true })
  fakeAccount: string;

  @Column({ type: 'citext', nullable: true })
  bulkPurAc: string;

  @Column({ type: 'citext', nullable: true })
  openAc: string;

  @Column({ type: 'citext', nullable: true })
  closingAc: string;

  @Column({ type: 'citext', nullable: true })
  expenseAc: string;

  @Column({ type: 'citext', nullable: true })
  bulkSaleAc: string;

  @Column({ type: 'citext', nullable: true })
  purchaseAc: string;

  @Column({ type: 'citext', nullable: true })
  saleAc: string;

  @Column({ type: 'citext', nullable: true })
  profitAc: string;

  @Column({ type: 'citext', nullable: true })
  bulkProficAc: string;

  @Column({ type: 'citext', nullable: true })
  purchaseRetCancAc: string;

  @Column({ type: 'citext', nullable: true })
  purchaseBlkCancAc: string;

  @Column({ type: 'citext', nullable: true })
  saleRetCancAc: string;

  @Column({ type: 'citext', nullable: true })
  saleBlkCancAc: string;

  @Column({ type: 'citext', nullable: true })
  branchPurAc: string;

  @Column({ type: 'citext', nullable: true })
  branchSaleAc: string;

  @Column({ type: 'citext', nullable: true })
  profitAcBrnSale: string;

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
}
