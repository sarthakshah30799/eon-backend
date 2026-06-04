import { ApiProperty } from '@nestjs/swagger';
import { Product } from '../product.entity';

export class ProductResponseDto {
  @ApiProperty({ description: 'Product ID (UUID)' })
  id: string;

  @ApiProperty({ description: 'Unique product code' })
  productCode: string;

  @ApiProperty({ description: 'Product description' })
  productDescription: string;

  // Accounting Configuration
  @ApiProperty({ description: 'A/C of Issuer', required: false })
  acOfIssuer: string;

  @ApiProperty({ description: 'Commission A/C', required: false })
  commissionAc: string;

  @ApiProperty({ description: 'Fake Account', required: false })
  fakeAccount: string;

  @ApiProperty({ description: 'Bulk Pur. A/C', required: false })
  bulkPurAc: string;

  @ApiProperty({ description: 'Open A/C', required: false })
  openAc: string;

  @ApiProperty({ description: 'Closing A/C', required: false })
  closingAc: string;

  @ApiProperty({ description: 'Expense A/C', required: false })
  expenseAc: string;

  @ApiProperty({ description: 'Bulk Sale A/C', required: false })
  bulkSaleAc: string;

  @ApiProperty({ description: 'Purchase A/C', required: false })
  purchaseAc: string;

  @ApiProperty({ description: 'Sale A/C', required: false })
  saleAc: string;

  @ApiProperty({ description: 'Profit A/C', required: false })
  profitAc: string;

  @ApiProperty({ description: 'Bulk Profit A/C', required: false })
  bulkProficAc: string;

  @ApiProperty({ description: 'Purchase Ret.Canc.A/C', required: false })
  purchaseRetCancAc: string;

  @ApiProperty({ description: 'Purchase Blk Canc.A/C', required: false })
  purchaseBlkCancAc: string;

  @ApiProperty({ description: 'Sale Ret.Canc.A/C', required: false })
  saleRetCancAc: string;

  @ApiProperty({ description: 'Sale Blk Canc.A/C', required: false })
  saleBlkCancAc: string;

  @ApiProperty({ description: 'Branch Purchase A/C', required: false })
  branchPurAc: string;

  @ApiProperty({ description: 'Branch Sale A/C', required: false })
  branchSaleAc: string;

  @ApiProperty({ description: 'Profit A/C Branch Sale', required: false })
  profitAcBrnSale: string;

  // Additional Fields
  @ApiProperty({ description: 'Retail percent/factor', required: false })
  retail: string;

  @ApiProperty({ description: 'Bulk Fee', required: false })
  bulkFee: string;

  @ApiProperty({ description: 'Commission Limit', required: false })
  commLimit: string;

  @ApiProperty({ description: 'Max Amount Commission', required: false })
  maxAmtComm: string;

  @ApiProperty({ description: 'Allow Fraction in FE Amount' })
  allowFractionInFEAmount: boolean;

  @ApiProperty({ description: 'Separate Settlement for Each Instrument' })
  separateSettlementForEachInstrument: boolean;

  @ApiProperty({ description: 'Pick Sale Rate Avg as Settlement Rate' })
  pickSaleRateAvgAsSettlementRate: boolean;

  @ApiProperty({ description: 'Reload flag' })
  reload: boolean;

  @ApiProperty({ description: 'Automate Settlement Rate' })
  automateSettlementRate: boolean;

  @ApiProperty({ description: 'Is Active Product' })
  isActiveProduct: boolean;

  @ApiProperty({ description: 'Split and Store Blank Stock Received' })
  splitAndStoreBlankStockReceived: boolean;

  @ApiProperty({ description: 'Product Requires Settlement' })
  productRequiresSettlement: boolean;

  @ApiProperty({ description: 'Level Priority', required: false })
  levelPriority: string;

  @ApiProperty({ description: 'Pass Auto Receipt of Stock When Sold' })
  passAutoReceiptOfStockWhenSold: boolean;

  @ApiProperty({ description: 'Reversal Effect of Profits' })
  reversalEffectOfProfits: boolean;

  @ApiProperty({ description: 'Allow Changing Denomination in Sales' })
  allowChangingDenominationInSales: boolean;

  @ApiProperty({ description: 'Allow Multicard' })
  allowMulticard: boolean;

  @ApiProperty({ description: 'Ask Reference' })
  askReference: boolean;

  // Configurations for Retail/Bulk Transactions
  @ApiProperty({ description: 'Available in Retail Buying' })
  availableInRetailBuying: boolean;

  @ApiProperty({ description: 'Series Applicable for Retail Buying' })
  retailBuyingSeriesApplicable: boolean;

  @ApiProperty({ description: 'Available in Retail Selling' })
  availableInRetailSelling: boolean;

  @ApiProperty({ description: 'Series Applicable for Retail Selling' })
  retailSellingSeriesApplicable: boolean;

  @ApiProperty({ description: 'Available in Bulk Buying' })
  availableInBulkBuying: boolean;

  @ApiProperty({ description: 'Series Applicable for Bulk Buying' })
  bulkBuyingSeriesApplicable: boolean;

  @ApiProperty({ description: 'Available in Bulk Selling' })
  availableInBulkSelling: boolean;

  @ApiProperty({ description: 'Series Applicable for Bulk Selling' })
  bulkSellingSeriesApplicable: boolean;

  @ApiProperty({ description: 'Allow Product Cancellation' })
  allowProductCancellation: boolean;

  @ApiProperty({ description: 'Maintain Blank Stock of Product?' })
  maintainBlankStockOfProduct: boolean;

  @ApiProperty({ description: 'Denomination Applicable' })
  denominationApplicable: boolean;

  @ApiProperty({ description: 'Allow Add-On Linking' })
  allowAddOnLinking: boolean;

  @ApiProperty({ description: 'Instrument Issuing Authority Required' })
  instrumentIssuingAuthorityRequired: boolean;

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at timestamp' })
  updatedAt: Date;

  static fromEntity(entity: Product): ProductResponseDto {
    const dto = new ProductResponseDto();
    dto.id = entity.id;
    dto.productCode = entity.productCode;
    dto.productDescription = entity.productDescription;
    
    // Accounting
    dto.acOfIssuer = entity.acOfIssuer;
    dto.commissionAc = entity.commissionAc;
    dto.fakeAccount = entity.fakeAccount;
    dto.bulkPurAc = entity.bulkPurAc;
    dto.openAc = entity.openAc;
    dto.closingAc = entity.closingAc;
    dto.expenseAc = entity.expenseAc;
    dto.bulkSaleAc = entity.bulkSaleAc;
    dto.purchaseAc = entity.purchaseAc;
    dto.saleAc = entity.saleAc;
    dto.profitAc = entity.profitAc;
    dto.bulkProficAc = entity.bulkProficAc;
    dto.purchaseRetCancAc = entity.purchaseRetCancAc;
    dto.purchaseBlkCancAc = entity.purchaseBlkCancAc;
    dto.saleRetCancAc = entity.saleRetCancAc;
    dto.saleBlkCancAc = entity.saleBlkCancAc;
    dto.branchPurAc = entity.branchPurAc;
    dto.branchSaleAc = entity.branchSaleAc;
    dto.profitAcBrnSale = entity.profitAcBrnSale;

    // Additional Fields
    dto.retail = entity.retail;
    dto.bulkFee = entity.bulkFee;
    dto.commLimit = entity.commLimit;
    dto.maxAmtComm = entity.maxAmtComm;
    dto.allowFractionInFEAmount = entity.allowFractionInFEAmount;
    dto.separateSettlementForEachInstrument = entity.separateSettlementForEachInstrument;
    dto.pickSaleRateAvgAsSettlementRate = entity.pickSaleRateAvgAsSettlementRate;
    dto.reload = entity.reload;
    dto.automateSettlementRate = entity.automateSettlementRate;
    dto.isActiveProduct = entity.isActiveProduct;
    dto.splitAndStoreBlankStockReceived = entity.splitAndStoreBlankStockReceived;
    dto.productRequiresSettlement = entity.productRequiresSettlement;
    dto.levelPriority = entity.levelPriority;
    dto.passAutoReceiptOfStockWhenSold = entity.passAutoReceiptOfStockWhenSold;
    dto.reversalEffectOfProfits = entity.reversalEffectOfProfits;
    dto.allowChangingDenominationInSales = entity.allowChangingDenominationInSales;
    dto.allowMulticard = entity.allowMulticard;
    dto.askReference = entity.askReference;

    // Configs
    dto.availableInRetailBuying = entity.availableInRetailBuying;
    dto.retailBuyingSeriesApplicable = entity.retailBuyingSeriesApplicable;
    dto.availableInRetailSelling = entity.availableInRetailSelling;
    dto.retailSellingSeriesApplicable = entity.retailSellingSeriesApplicable;
    dto.availableInBulkBuying = entity.availableInBulkBuying;
    dto.bulkBuyingSeriesApplicable = entity.bulkBuyingSeriesApplicable;
    dto.availableInBulkSelling = entity.availableInBulkSelling;
    dto.bulkSellingSeriesApplicable = entity.bulkSellingSeriesApplicable;
    dto.allowProductCancellation = entity.allowProductCancellation;
    dto.maintainBlankStockOfProduct = entity.maintainBlankStockOfProduct;
    dto.denominationApplicable = entity.denominationApplicable;
    dto.allowAddOnLinking = entity.allowAddOnLinking;
    dto.instrumentIssuingAuthorityRequired = entity.instrumentIssuingAuthorityRequired;

    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    
    return dto;
  }
}
