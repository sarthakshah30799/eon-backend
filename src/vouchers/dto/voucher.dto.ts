import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type, Transform } from "class-transformer";
import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsInt, IsNotEmpty, IsNumberString, IsOptional, IsString, IsUUID, Matches, Max, Min, ValidateNested } from "class-validator";
import { EmptyStringToUndefined } from "../../common/decorators/empty-string-to-undefined.decorator";
import { VoucherEntryDirection } from "../voucher.enums";

export class CreateVoucherItemDto {
  @ApiProperty() @IsUUID() itemTypeOptionId: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() subledgerPartyProfileId?: string | null;
  @ApiProperty() @IsUUID() accountId: string;
  @ApiProperty({ enum: VoucherEntryDirection }) @IsEnum(VoucherEntryDirection) direction: VoucherEntryDirection;
  @ApiProperty({ example: "100.00" }) @IsNumberString() amount: string;
}

export class CreatePartyVoucherDto {
  @ApiProperty() @IsDateString() transactionDate: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() branchId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() counterId?: string;
  @ApiProperty() @IsUUID() accountTypeOptionId: string;
  @ApiProperty() @IsUUID() headerAccountId: string;
  @ApiProperty() @IsUUID() entityTypeOptionId: string;
  @ApiProperty() @IsUUID() partyProfileId: string;
  @ApiPropertyOptional() @EmptyStringToUndefined() @IsOptional() @IsString() @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/i, { message: "PAN Number must be a valid 10-character Indian PAN" }) panNumber?: string;
  @ApiPropertyOptional() @EmptyStringToUndefined() @IsOptional() @IsString() panName?: string;
  @ApiPropertyOptional() @EmptyStringToUndefined() @IsOptional() @IsDateString() panDob?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() chequeNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() chequeDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() chequeBranch?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() drawnOn?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() remarkOptionId?: string | null;
  @ApiProperty() @Transform(({ value }) => typeof value === "string" ? value.trim() : value) @IsString() @IsNotEmpty() narration: string;
  @ApiProperty() @IsString() @IsNotEmpty() idempotencyKey: string;
  @ApiProperty({ type: [CreateVoucherItemDto] }) @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CreateVoucherItemDto) items: CreateVoucherItemDto[];
}

export class CreateReceiptVoucherDto extends CreatePartyVoucherDto {}
export class CreatePaymentVoucherDto extends CreatePartyVoucherDto {}

export class CreateJournalVoucherDto {
  @ApiProperty() @IsDateString() transactionDate: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() branchId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() counterId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() remarkOptionId?: string | null;
  @ApiProperty() @Transform(({ value }) => typeof value === "string" ? value.trim() : value) @IsString() @IsNotEmpty() narration: string;
  @ApiProperty() @IsString() @IsNotEmpty() idempotencyKey: string;
  @ApiProperty({ type: [CreateVoucherItemDto] }) @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CreateVoucherItemDto) items: CreateVoucherItemDto[];
}

const splitCsv = ({ value }: { value: unknown }) => value === undefined || value === null || value === "" ? undefined : (Array.isArray(value) ? value : String(value).split(",")).map(String);

export class VoucherListQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dateFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dateTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() partyProfileId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() branchId?: string;
  @ApiPropertyOptional({ default: 1 }) @Type(() => Number) @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional({ default: 20 }) @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}

export class AvailableAdvanceQueryDto {
  @ApiProperty() @IsUUID() partyProfileId: string;
  @ApiProperty() @IsUUID() branchId: string;
  @ApiProperty() @IsUUID() counterId: string;
  @ApiProperty() @IsDateString() transactionDate: string;
  @ApiProperty({ enum: ["CASH", "CHEQUE"] }) @IsString() paymentMethod: "CASH" | "CHEQUE";
  @ApiPropertyOptional() @IsOptional() @IsUUID() excludeTransactionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
}

export class AdvanceApplicationPayloadDto {
  @ApiProperty() @IsUUID() voucherId: string;
  @ApiProperty() @IsNumberString() amount: string;
}
