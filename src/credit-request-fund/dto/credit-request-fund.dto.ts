import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type, Transform } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateNested,
} from "class-validator";
import { EmptyStringToUndefined } from "../../common/decorators/empty-string-to-undefined.decorator";
import { PaginationQueryDto } from "../../common/pagination";
import { TransactionPaymentMethod } from "../../transactions/transactions.enums";
import { VoucherEntryDirection } from "../../vouchers/voucher.enums";
import { CreditRequestFundStatus } from "../credit-request-fund.enums";

export class CreateCreditRequestFundItemDto {
  @ApiProperty() @IsUUID() itemTypeOptionId: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() subledgerPartyProfileId?:
    | string
    | null;
  @ApiPropertyOptional() @IsOptional() @IsUUID() subledgerBranchId?:
    | string
    | null;
  @ApiProperty() @IsUUID() accountId: string;
  @ApiProperty({ enum: VoucherEntryDirection })
  @IsEnum(VoucherEntryDirection)
  direction: VoucherEntryDirection;
  @ApiProperty({ example: "100.00" }) @IsNumberString() amount: string;
}

export class CreateCreditRequestFundDto {
  @ApiProperty() @IsDateString() transactionDate: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() branchId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() counterId?: string;
  @ApiProperty() @IsUUID() destinationBranchId: string;
  @ApiProperty() @IsUUID() accountTypeOptionId: string;
  @ApiProperty() @IsUUID() headerAccountId: string;
  @ApiProperty() @IsUUID() entityTypeOptionId: string;
  @ApiProperty() @IsUUID() partyProfileId: string;
  @ApiPropertyOptional()
  @EmptyStringToUndefined()
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/i, {
    message: "PAN Number must be a valid 10-character Indian PAN",
  })
  paidByPanNumber?: string;
  @ApiPropertyOptional()
  @EmptyStringToUndefined()
  @IsOptional()
  @IsString()
  paidByPanName?: string;
  @ApiPropertyOptional()
  @EmptyStringToUndefined()
  @IsOptional()
  @IsDateString()
  paidByPanDob?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  panHolderRelationOptionId?: string | null;
  @ApiPropertyOptional()
  @EmptyStringToUndefined()
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/i, {
    message: "Traveler PAN Number must be a valid 10-character Indian PAN",
  })
  travelerPanNumber?: string;
  @ApiPropertyOptional()
  @EmptyStringToUndefined()
  @IsOptional()
  @IsString()
  travelerPanName?: string;
  @ApiPropertyOptional()
  @EmptyStringToUndefined()
  @IsOptional()
  @IsDateString()
  travelerPanDob?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() chequeNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() chequeDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() chequeBranch?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() drawnOn?: string;
  @ApiPropertyOptional({ enum: TransactionPaymentMethod })
  @EmptyStringToUndefined()
  @IsOptional()
  @IsIn(Object.values(TransactionPaymentMethod))
  paymentMethod?: TransactionPaymentMethod;
  @ApiPropertyOptional() @IsOptional() @IsUUID() remarkOptionId?: string | null;
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  narration: string;
  @ApiProperty() @IsString() @IsNotEmpty() idempotencyKey: string;
  @ApiProperty({ type: [CreateCreditRequestFundItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateCreditRequestFundItemDto)
  items: CreateCreditRequestFundItemDto[];
}

export class UpdateCreditRequestFundDto extends CreateCreditRequestFundDto {}

export class CreditRequestFundListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CreditRequestFundStatus })
  @IsOptional()
  @IsEnum(CreditRequestFundStatus)
  status?: CreditRequestFundStatus;
  @ApiPropertyOptional() @IsOptional() @IsUUID() branchId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() destinationBranchId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() partyProfileId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dateFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dateTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
}

export class RejectCreditRequestFundDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  remarks: string;
}

export class ApproveCreditRequestFundDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  transactionDate?: string;
}
