import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";
import { EmptyStringToUndefined } from "../../common/decorators/empty-string-to-undefined.decorator";
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

  @ApiPropertyOptional({
    format: "uuid",
    description: "Preferred outstanding scope key when passenger exists",
  })
  @EmptyStringToUndefined()
  @IsOptional()
  @IsUUID()
  passengerId?: string | null;

  @ApiPropertyOptional({
    description:
      "Used for outstanding scope when passengerId is not available. Incomplete values are ignored (outstanding treated as zero).",
  })
  @EmptyStringToUndefined()
  @IsOptional()
  @IsString()
  panNumber?: string | null;
}
