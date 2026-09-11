import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type, Transform } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateNested,
  IsIn,
} from "class-validator";
import { EmptyStringToUndefined } from "../../common/decorators/empty-string-to-undefined.decorator";
import { PaginationQueryDto } from "../../common/pagination";
import { TransactionPaymentMethod } from "../../transactions/transactions.enums";
import { VoucherEntryDirection } from "../voucher.enums";

export class CreateVoucherItemDto {
  @ApiProperty() @IsUUID() itemTypeOptionId: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() subledgerPartyProfileId?:
    | string
    | null;
  @ApiPropertyOptional({
    description:
      "Required for ACCOUNT lines. Optional for bill lines (server fills purchase/sale control account).",
  })
  @IsOptional()
  @IsUUID()
  accountId?: string;
  @ApiProperty({ enum: VoucherEntryDirection })
  @IsEnum(VoucherEntryDirection)
  direction: VoucherEntryDirection;
  @ApiProperty({ example: "100.00" }) @IsNumberString() amount: string;
  @ApiPropertyOptional({
    description: "Required when item type is a purchase/sale profile.",
  })
  @IsOptional()
  @IsUUID()
  settledTransactionId?: string | null;
}

export class OutstandingBillsQueryDto extends PaginationQueryDto {
  @ApiProperty() @IsUUID() partyProfileId: string;
  @ApiProperty({
    description: "VOUCHER_ITEM_TYPE / transactions.slug value e.g. SALE_FFMC",
  })
  @IsString()
  @IsNotEmpty()
  slug: string;
  @ApiProperty() @IsUUID() branchId: string;
  @ApiProperty() @IsUUID() counterId: string;
  @ApiProperty() @IsDateString() transactionDate: string;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
}

export class CreatePartyVoucherDto {
  @ApiProperty() @IsDateString() transactionDate: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() branchId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() counterId?: string;
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
  panNumber?: string;
  @ApiPropertyOptional()
  @EmptyStringToUndefined()
  @IsOptional()
  @IsString()
  panName?: string;
  @ApiPropertyOptional()
  @EmptyStringToUndefined()
  @IsOptional()
  @IsDateString()
  panDob?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() chequeNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() chequeDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() chequeBranch?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() drawnOn?: string;
  @ApiPropertyOptional({
    enum: [
      TransactionPaymentMethod.UPI,
      TransactionPaymentMethod.NEFT,
      TransactionPaymentMethod.RTGS,
    ],
  })
  @EmptyStringToUndefined()
  @IsOptional()
  @IsIn([
    TransactionPaymentMethod.UPI,
    TransactionPaymentMethod.NEFT,
    TransactionPaymentMethod.RTGS,
  ])
  paymentMethod?:
    | typeof TransactionPaymentMethod.UPI
    | typeof TransactionPaymentMethod.NEFT
    | typeof TransactionPaymentMethod.RTGS;
  @ApiPropertyOptional() @IsOptional() @IsUUID() remarkOptionId?: string | null;
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  narration: string;
  @ApiProperty() @IsString() @IsNotEmpty() idempotencyKey: string;
  @ApiProperty({ type: [CreateVoucherItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateVoucherItemDto)
  items: CreateVoucherItemDto[];
}

export class CreateReceiptVoucherDto extends CreatePartyVoucherDto {}
export class CreatePaymentVoucherDto extends CreatePartyVoucherDto {}

export class CreateJournalVoucherDto {
  @ApiProperty() @IsDateString() transactionDate: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() branchId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() counterId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() remarkOptionId?: string | null;
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  narration: string;
  @ApiProperty() @IsString() @IsNotEmpty() idempotencyKey: string;
  @ApiProperty({ type: [CreateVoucherItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateVoucherItemDto)
  items: CreateVoucherItemDto[];
}

export class CreateDepositWithdrawalVoucherDto {
  @ApiProperty() @IsDateString() transactionDate: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() branchId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() counterId?: string;
  @ApiProperty() @IsString() @IsNotEmpty() chequeNumber: string;
  @ApiProperty() @IsDateString() chequeDate: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() remarkOptionId?: string | null;
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  narration: string;
  @ApiProperty() @IsString() @IsNotEmpty() idempotencyKey: string;
  @ApiProperty({
    type: [CreateVoucherItemDto],
    description:
      "Exactly 2 lines (deposited in, withdrawal from) or 3 when handling fee > 0",
  })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => CreateVoucherItemDto)
  items: CreateVoucherItemDto[];
}

export class CreateAdviceVoucherDto {
  @ApiProperty() @IsDateString() transactionDate: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() branchId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() counterId?: string;
  @ApiProperty({ description: "Destination branch that will honour the advice" })
  @IsUUID()
  destinationBranchId: string;
  @ApiProperty() @IsUUID() entityTypeOptionId: string;
  @ApiProperty() @IsUUID() partyProfileId: string;
  @ApiPropertyOptional()
  @EmptyStringToUndefined()
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/i, {
    message: "PAN Number must be a valid 10-character Indian PAN",
  })
  panNumber?: string;
  @ApiPropertyOptional()
  @EmptyStringToUndefined()
  @IsOptional()
  @IsString()
  panName?: string;
  @ApiPropertyOptional()
  @EmptyStringToUndefined()
  @IsOptional()
  @IsDateString()
  panDob?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() remarkOptionId?: string | null;
  @ApiProperty()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  narration: string;
  @ApiProperty() @IsString() @IsNotEmpty() idempotencyKey: string;
  @ApiProperty({ type: [CreateVoucherItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateVoucherItemDto)
  items: CreateVoucherItemDto[];
}

export class HonourAdviceVoucherDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() branchId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() counterId?: string;
}

const splitCsv = ({ value }: { value: unknown }) =>
  value === undefined || value === null || value === ""
    ? undefined
    : (Array.isArray(value) ? value : String(value).split(",")).map(String);

export class VoucherListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dateFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dateTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() partyProfileId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() branchId?: string;
}

export class AvailableAdvanceQueryDto {
  @ApiProperty() @IsUUID() partyProfileId: string;
  @ApiProperty() @IsUUID() branchId: string;
  @ApiProperty() @IsUUID() counterId: string;
  @ApiProperty() @IsDateString() transactionDate: string;
  @ApiProperty({ enum: ["CASH", "CHEQUE"] }) @IsString() paymentMethod:
    | "CASH"
    | "CHEQUE";
  @ApiPropertyOptional() @IsOptional() @IsUUID() excludeTransactionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
}

export class AdvanceApplicationPayloadDto {
  @ApiProperty() @IsUUID() voucherId: string;
  @ApiProperty() @IsNumberString() amount: string;
}
