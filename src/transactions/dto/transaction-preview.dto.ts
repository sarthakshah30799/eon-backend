import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { TransactionType } from "../transactions.enums";

export class TransactionTaxPreviewItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  currencyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  quantity?: string | number;

  @ApiPropertyOptional()
  @IsOptional()
  rate?: string | number;

  @ApiPropertyOptional()
  @IsOptional()
  per?: string | number;

  @ApiPropertyOptional()
  @IsOptional()
  total?: string | number;
}

export class TransactionTaxPreviewChargeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  amount?: string | number;

  @ApiPropertyOptional()
  @IsOptional()
  gstRate?: string | number;
}

export class TransactionTaxPreviewDto {
  @ApiPropertyOptional({ enum: TransactionType })
  @IsOptional()
  @IsEnum(TransactionType)
  transactionType?: TransactionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slug?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  partyProfileId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  partyProfileApplyTax?: boolean;

  @ApiPropertyOptional({ type: () => [TransactionTaxPreviewItemDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => TransactionTaxPreviewItemDto)
  items?: TransactionTaxPreviewItemDto[];

  @ApiPropertyOptional({ type: () => [TransactionTaxPreviewChargeDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => TransactionTaxPreviewChargeDto)
  additionalCharges?: TransactionTaxPreviewChargeDto[];
}

export class TransactionTcsPreviewDto {
  @ApiProperty({ enum: TransactionType })
  @IsEnum(TransactionType)
  transactionType: TransactionType;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  purposeId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slug?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  preTcsFinalAmount?: string | number | null;

  @ApiPropertyOptional()
  @IsOptional()
  itemBaseAmount?: string | number | null;

  @ApiPropertyOptional()
  @IsOptional()
  itemTaxAmount?: string | number | null;

  @ApiPropertyOptional()
  @IsOptional()
  additionalChargeBaseAmount?: string | number | null;

  @ApiPropertyOptional()
  @IsOptional()
  additionalChargeTaxAmount?: string | number | null;

  @ApiPropertyOptional()
  @IsOptional()
  loanAmount?: string | number | null;

  @ApiPropertyOptional()
  @IsOptional()
  declaredAmount?: string | number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  itrFiled?: boolean | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  tcsDeclarationAccepted?: boolean | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isProprietorship?: boolean | null;

  @ApiPropertyOptional()
  @IsOptional()
  maxTcsRatePercent?: string | number | null;
}

export class PurchaseRulePreviewDto {
  @ApiPropertyOptional({ enum: TransactionType })
  @IsOptional()
  @IsEnum(TransactionType)
  transactionType?: TransactionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  slug?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  counterId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transactionDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  passenger?: Record<string, unknown> | null;

  @ApiPropertyOptional()
  @IsOptional()
  items?: Array<Record<string, unknown>>;

  @ApiPropertyOptional()
  @IsOptional()
  payments?: Array<Record<string, unknown>>;
}

export class ApproveTransactionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  approvalRemarks?: string | null;
}

export class RejectTransactionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rejectionReason?: string | null;
}
