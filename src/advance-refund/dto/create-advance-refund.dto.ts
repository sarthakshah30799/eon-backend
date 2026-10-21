import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from "class-validator";
import {
  AdvanceRefundPayoutSource,
  AdvanceRefundType,
} from "../advance-refund.enums";

export class CreateAdvanceRefundItemDto {
  @ApiProperty({ description: "Receipt Voucher ID (CFR) being refunded" })
  @IsUUID()
  @IsNotEmpty()
  receiptVoucherId: string;

  @ApiProperty({ description: "Refund amount allocated from this receipt", example: "20000.00" })
  @IsNumberString()
  @IsNotEmpty()
  refundAmount: string;
}

export class CreateAdvanceRefundDto {
  @ApiProperty({ description: "Branch ID (UUID)" })
  @IsUUID()
  @IsNotEmpty()
  branchId: string;

  @ApiProperty({ description: "Counter ID (UUID)" })
  @IsUUID()
  @IsNotEmpty()
  counterId: string;

  @ApiProperty({ description: "Transaction Date (YYYY-MM-DD)" })
  @IsDateString()
  @IsNotEmpty()
  transactionDate: string;

  @ApiProperty({ description: "As-on Date for filtering advances (YYYY-MM-DD)" })
  @IsDateString()
  @IsNotEmpty()
  asOnDate: string;

  @ApiProperty({ description: "Party Profile ID (UUID)" })
  @IsUUID()
  @IsNotEmpty()
  partyProfileId: string;

  @ApiPropertyOptional({ description: "PAN Card Number" })
  @IsString()
  @IsOptional()
  panNumber?: string;

  @ApiPropertyOptional({ description: "PAN Holder Name" })
  @IsString()
  @IsOptional()
  panName?: string;

  @ApiPropertyOptional({ description: "PAN Date of Birth (YYYY-MM-DD)" })
  @IsDateString()
  @IsOptional()
  panDob?: string;

  @ApiProperty({ enum: AdvanceRefundType, description: "Refund or Knock Off" })
  @IsEnum(AdvanceRefundType)
  refundType: AdvanceRefundType;

  @ApiProperty({ description: "Narration / remarks" })
  @IsString()
  @IsNotEmpty()
  narration: string;

  @ApiPropertyOptional({ description: "Remark Option ID (UUID)" })
  @IsUUID()
  @IsOptional()
  remarkOptionId?: string;

  // Knock Off fields
  @ApiPropertyOptional({ description: "Account Profile ID for Knock Off (Income/Round-off)" })
  @IsUUID()
  @IsOptional()
  knockOffAccountId?: string;

  // Refund fields
  @ApiPropertyOptional({ enum: AdvanceRefundPayoutSource, description: "Payout route" })
  @IsEnum(AdvanceRefundPayoutSource)
  @IsOptional()
  payoutSource?: AdvanceRefundPayoutSource;

  @ApiPropertyOptional({ description: "Paying Bank Account ID (UUID) for local payout" })
  @IsUUID()
  @IsOptional()
  payingBankAccountId?: string;

  @ApiPropertyOptional({ description: "Payment Method (NEFT, RTGS, IMPS, UPI, CHEQUE)" })
  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @ApiPropertyOptional({ description: "Beneficiary Account Number" })
  @IsString()
  @IsOptional()
  beneficiaryAccountNumber?: string;

  @ApiPropertyOptional({ description: "Beneficiary IFSC Code" })
  @IsString()
  @IsOptional()
  beneficiaryIfscCode?: string;

  @ApiPropertyOptional({ description: "Beneficiary Name" })
  @IsString()
  @IsOptional()
  beneficiaryName?: string;

  @ApiPropertyOptional({ description: "Beneficiary Bank Name" })
  @IsString()
  @IsOptional()
  bankName?: string;

  @ApiPropertyOptional({ description: "Cheque Number" })
  @IsString()
  @IsOptional()
  chequeNumber?: string;

  @ApiPropertyOptional({ description: "Cheque Date (YYYY-MM-DD)" })
  @IsDateString()
  @IsOptional()
  chequeDate?: string;

  @ApiPropertyOptional({ description: "Drawn On Bank" })
  @IsString()
  @IsOptional()
  drawnOn?: string;

  @ApiProperty({ type: [CreateAdvanceRefundItemDto], description: "Items to resolve" })
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => CreateAdvanceRefundItemDto)
  items: CreateAdvanceRefundItemDto[];
}
