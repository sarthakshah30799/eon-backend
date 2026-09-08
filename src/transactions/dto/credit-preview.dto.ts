import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";
import { TransactionType } from "../transactions.enums";

export class CreditPreviewPaymentRowDto {
  @ApiPropertyOptional({ example: "1000.00" })
  @IsOptional()
  amount?: string | number | null;
}

export class CreditPreviewDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  partyProfileId: string;

  @ApiProperty({ enum: TransactionType })
  @IsEnum(TransactionType)
  transactionType: TransactionType;

  @ApiProperty({ example: "2026-09-07" })
  @IsNotEmpty()
  transactionDate: string;

  @ApiProperty({ example: 100000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  payableAmount: number;

  @ApiPropertyOptional({ type: [CreditPreviewPaymentRowDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreditPreviewPaymentRowDto)
  payments?: CreditPreviewPaymentRowDto[];

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  excludeTransactionId?: string | null;
}
