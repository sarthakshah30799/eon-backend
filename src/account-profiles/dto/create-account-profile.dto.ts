import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, Length } from "class-validator";

export class CreateAccountProfileDto {
  @ApiPropertyOptional({ description: "Division / Department" })
  @IsUUID()
  @IsOptional()
  divisionDept?: string;

  @ApiProperty({ description: "Account Code", example: "ACCINT", minLength: 5, maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @Length(5, 20, { message: "Account Code must be between 5 and 20 characters" })
  accountCode: string;

  @ApiProperty({ description: "Account Name", example: "ACCRUED FD INTEREST", minLength: 10, maxLength: 250 })
  @IsString()
  @IsNotEmpty()
  @Length(10, 250, { message: "Account Name must be between 10 and 250 characters" })
  accountName: string;

  @ApiPropertyOptional({ description: "Account Type" })
  @IsUUID()
  @IsOptional()
  accountType?: string;

  @ApiPropertyOptional({ description: "Sub Ledger" })
  @IsUUID()
  @IsOptional()
  subLedger?: string;

  @ApiPropertyOptional({ description: "Bank Nature" })
  @IsUUID()
  @IsOptional()
  bankNature?: string;

  @ApiProperty({ description: "Currency ID (UUID)" })
  @IsUUID()
  @IsNotEmpty()
  currencyId: string;

  @ApiProperty({ description: "Financial Code ID (UUID)" })
  @IsUUID()
  @IsNotEmpty()
  financialCodeId: string;

  @ApiPropertyOptional({ description: "Financial Sub Profile ID (UUID)" })
  @IsUUID()
  @IsOptional()
  financialSubProfileId?: string;

  @ApiPropertyOptional({ description: "Petty Cash Expense ID" })
  @IsString()
  @IsOptional()
  pettyCashExpenseId?: string;

  @ApiPropertyOptional({ description: "Zero Balance at EOD flag", default: false })
  @IsBoolean()
  @IsOptional()
  zeroBalanceAtEod?: boolean;

  @ApiPropertyOptional({ description: "Branch ID to Transfer (UUID)" })
  @IsUUID()
  @IsOptional()
  branchIdToTransfer?: string;

  @ApiPropertyOptional({ description: "Map To Account ID (UUID)" })
  @IsUUID()
  @IsOptional()
  mapToAccountId?: string;

  @ApiPropertyOptional({ description: "Retail Sale flag", default: false })
  @IsBoolean()
  @IsOptional()
  retailSale?: boolean;

  @ApiPropertyOptional({ description: "Retail Purchase flag", default: false })
  @IsBoolean()
  @IsOptional()
  retailPurchase?: boolean;

  @ApiPropertyOptional({ description: "Bulk Sale flag", default: false })
  @IsBoolean()
  @IsOptional()
  bulkSale?: boolean;

  @ApiPropertyOptional({ description: "Bulk Purchase flag", default: false })
  @IsBoolean()
  @IsOptional()
  bulkPurchase?: boolean;

  @ApiPropertyOptional({ description: "Expense flag", default: false })
  @IsBoolean()
  @IsOptional()
  expense?: boolean;

  @ApiPropertyOptional({ description: "Receipt flag", default: false })
  @IsBoolean()
  @IsOptional()
  receipt?: boolean;

  @ApiPropertyOptional({ description: "Payment flag", default: false })
  @IsBoolean()
  @IsOptional()
  payment?: boolean;

  @ApiPropertyOptional({ description: "Journal Voucher (JV) flag", default: false })
  @IsBoolean()
  @IsOptional()
  journalVoucher?: boolean;

  @ApiPropertyOptional({ description: "Active status flag", default: true })
  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @ApiPropertyOptional({ description: "CMS Bank flag", default: false })
  @IsBoolean()
  @IsOptional()
  cmsBank?: boolean;

  @ApiPropertyOptional({ description: "Direct Remittance flag", default: false })
  @IsBoolean()
  @IsOptional()
  directRemittance?: boolean;
}
