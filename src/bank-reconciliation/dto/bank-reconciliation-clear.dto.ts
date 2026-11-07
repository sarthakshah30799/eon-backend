import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from "class-validator";

export const BankReconciliationSourceType = {
  TRANSACTION_PAYMENT: "TRANSACTION_PAYMENT",
  ACCOUNTING_VOUCHER: "ACCOUNTING_VOUCHER",
} as const;

export type BankReconciliationSourceType =
  (typeof BankReconciliationSourceType)[keyof typeof BankReconciliationSourceType];

export class BankReconciliationClearItemDto {
  @ApiProperty({ enum: Object.values(BankReconciliationSourceType) })
  @IsIn(Object.values(BankReconciliationSourceType))
  sourceType!: BankReconciliationSourceType;

  @ApiProperty()
  @IsUUID("4")
  sourceId!: string;

  @ApiProperty({ description: "Bank clearance / return date YYYY-MM-DD" })
  @IsDateString()
  bankDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reconciliationRemarks?: string;

  @ApiPropertyOptional({ description: "Cheque return / dishonor" })
  @IsOptional()
  @IsBoolean()
  isDishonored?: boolean;

  @ApiPropertyOptional({ description: "Required when isDishonored is true" })
  @ValidateIf((item: BankReconciliationClearItemDto) =>
    Boolean(item.isDishonored),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  reversalNumber?: string;
}

export class BankReconciliationClearDto {
  @ApiProperty({ type: [BankReconciliationClearItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BankReconciliationClearItemDto)
  items!: BankReconciliationClearItemDto[];
}
