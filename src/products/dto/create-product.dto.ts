import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  MaxLength,
  Length,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ description: 'Unique product code', example: 'PR', maxLength: 2 })
  @IsString()
  @IsNotEmpty()
  @Length(2, 2, { message: 'Product Code must be exactly 2 characters' })
  productCode: string;

  @ApiProperty({ description: 'Product description', example: 'General Trading Product', maxLength: 250 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  productDescription: string;

  // Accounting Configuration
  @ApiProperty({ description: 'A/C of Issuer', required: false, maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  acOfIssuer?: string;

  @ApiProperty({ description: 'Commission A/C', required: false, maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  commissionAc?: string;

  @ApiProperty({ description: 'Fake Account', required: false, maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  fakeAccount?: string;

  @ApiProperty({ description: 'Bulk Pur. A/C', required: false, maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  bulkPurAc?: string;

  @ApiProperty({ description: 'Open A/C', required: false, maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  openAc?: string;

  @ApiProperty({ description: 'Closing A/C', required: false, maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  closingAc?: string;

  @ApiProperty({ description: 'Expense A/C', required: false, maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  expenseAc?: string;

  @ApiProperty({ description: 'Bulk Sale A/C', required: false, maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  bulkSaleAc?: string;

  @ApiProperty({ description: 'Purchase A/C', required: false, maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  purchaseAc?: string;

  @ApiProperty({ description: 'Sale A/C', required: false, maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  saleAc?: string;

  @ApiProperty({ description: 'Profit A/C', required: false, maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  profitAc?: string;

  @ApiProperty({ description: 'Bulk Profit A/C', required: false, maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  bulkProficAc?: string;

  @ApiProperty({ description: 'Purchase Ret.Canc.A/C', required: false, maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  purchaseRetCancAc?: string;

  @ApiProperty({ description: 'Purchase Blk Canc.A/C', required: false, maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  purchaseBlkCancAc?: string;

  @ApiProperty({ description: 'Sale Ret.Canc.A/C', required: false, maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  saleRetCancAc?: string;

  @ApiProperty({ description: 'Sale Blk Canc.A/C', required: false, maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  saleBlkCancAc?: string;

  @ApiProperty({ description: 'Branch Purchase A/C', required: false, maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  branchPurAc?: string;

  @ApiProperty({ description: 'Branch Sale A/C', required: false, maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  branchSaleAc?: string;

  @ApiProperty({ description: 'Profit A/C Branch Sale', required: false, maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  profitAcBrnSale?: string;

  // Additional Fields
  @ApiProperty({ description: 'Retail percent/factor', required: false, maxLength: 50 })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  retail?: string;

  @ApiProperty({ description: 'Bulk Fee', required: false, maxLength: 50 })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  bulkFee?: string;

  @ApiProperty({ description: 'Commission Limit', required: false, maxLength: 50 })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  commLimit?: string;

  @ApiProperty({ description: 'Max Amount Commission', required: false, maxLength: 50 })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  maxAmtComm?: string;

  @ApiProperty({ description: 'Allow Fraction in FE Amount', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  allowFractionInFEAmount?: boolean;

  @ApiProperty({ description: 'Separate Settlement for Each Instrument', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  separateSettlementForEachInstrument?: boolean;

  @ApiProperty({ description: 'Pick Sale Rate Avg as Settlement Rate', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  pickSaleRateAvgAsSettlementRate?: boolean;

  @ApiProperty({ description: 'Reload flag', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  reload?: boolean;

  @ApiProperty({ description: 'Automate Settlement Rate', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  automateSettlementRate?: boolean;

  @ApiProperty({ description: 'Is Active Product', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  isActiveProduct?: boolean;

  @ApiProperty({ description: 'Split and Store Blank Stock Received', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  splitAndStoreBlankStockReceived?: boolean;

  @ApiProperty({ description: 'Product Requires Settlement', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  productRequiresSettlement?: boolean;

  @ApiProperty({ description: 'Level Priority', required: false, maxLength: 50 })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  levelPriority?: string;

  @ApiProperty({ description: 'Pass Auto Receipt of Stock When Sold', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  passAutoReceiptOfStockWhenSold?: boolean;

  @ApiProperty({ description: 'Reversal Effect of Profits', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  reversalEffectOfProfits?: boolean;

  @ApiProperty({ description: 'Allow Changing Denomination in Sales', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  allowChangingDenominationInSales?: boolean;

  @ApiProperty({ description: 'Allow Multicard', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  allowMulticard?: boolean;

  @ApiProperty({ description: 'Ask Reference', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  askReference?: boolean;

  // Configurations for Retail/Bulk Transactions
  @ApiProperty({ description: 'Available in Retail Buying', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  availableInRetailBuying?: boolean;

  @ApiProperty({ description: 'Series Applicable for Retail Buying', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  retailBuyingSeriesApplicable?: boolean;

  @ApiProperty({ description: 'Available in Retail Selling', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  availableInRetailSelling?: boolean;

  @ApiProperty({ description: 'Series Applicable for Retail Selling', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  retailSellingSeriesApplicable?: boolean;

  @ApiProperty({ description: 'Available in Bulk Buying', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  availableInBulkBuying?: boolean;

  @ApiProperty({ description: 'Series Applicable for Bulk Buying', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  bulkBuyingSeriesApplicable?: boolean;

  @ApiProperty({ description: 'Available in Bulk Selling', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  availableInBulkSelling?: boolean;

  @ApiProperty({ description: 'Series Applicable for Bulk Selling', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  bulkSellingSeriesApplicable?: boolean;

  @ApiProperty({ description: 'Allow Product Cancellation', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  allowProductCancellation?: boolean;

  @ApiProperty({ description: 'Maintain Blank Stock of Product?', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  maintainBlankStockOfProduct?: boolean;

  @ApiProperty({ description: 'Denomination Applicable', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  denominationApplicable?: boolean;

  @ApiProperty({ description: 'Allow Add-On Linking', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  allowAddOnLinking?: boolean;

  @ApiProperty({ description: 'Instrument Issuing Authority Required', required: false, default: false })
  @IsBoolean()
  @IsOptional()
  instrumentIssuingAuthorityRequired?: boolean;
}
