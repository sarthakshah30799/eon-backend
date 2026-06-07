import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, Length } from "class-validator";

export class CreateAccountProfileDto {
  @ApiPropertyOptional({ description: "Division / Department" })
  @IsString()
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
  @IsString()
  @IsOptional()
  accountType?: string;

  @ApiPropertyOptional({ description: "Sub Ledger" })
  @IsString()
  @IsOptional()
  subLedger?: string;

  @ApiPropertyOptional({ description: "Bank Nature" })
  @IsString()
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

  @ApiPropertyOptional({ description: "Do Sale flag", default: false })
  @IsBoolean()
  @IsOptional()
  doSale?: boolean;

  @ApiPropertyOptional({ description: "Do Purchase flag", default: false })
  @IsBoolean()
  @IsOptional()
  doPurchase?: boolean;

  @ApiPropertyOptional({ description: "Do Receipt flag", default: false })
  @IsBoolean()
  @IsOptional()
  doReceipt?: boolean;

  @ApiPropertyOptional({ description: "Do Payment flag", default: false })
  @IsBoolean()
  @IsOptional()
  doPayment?: boolean;

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
