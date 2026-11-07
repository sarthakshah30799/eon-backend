import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { BooleanQuery } from "../../common/transformers/parse-boolean-query";

export const BankReconciliationTransactionType = {
  RECEIPT_PAYMENT: "receipt-payment",
  BUYING_SELLING: "buying-selling",
  DEPOSIT_WITHDRAWAL: "deposit-withdrawal",
  ALL: "all",
} as const;

export type BankReconciliationTransactionType =
  (typeof BankReconciliationTransactionType)[keyof typeof BankReconciliationTransactionType];

export class BankReconciliationQueryDto {
  @ApiProperty({ description: "Start date in YYYY-MM-DD format" })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ description: "End date in YYYY-MM-DD format" })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ description: "Branch id" })
  @IsOptional()
  @IsUUID("4")
  branchId?: string;

  @ApiPropertyOptional({
    description:
      "Bank ledger account profile id. Omit or leave empty to include all bank ledger accounts.",
  })
  @IsOptional()
  @IsUUID("4")
  bankAccountId?: string;

  @ApiPropertyOptional({ description: "Passenger name search" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  passengerName?: string;

  @ApiPropertyOptional({
    enum: Object.values(BankReconciliationTransactionType),
  })
  @IsOptional()
  @IsIn(Object.values(BankReconciliationTransactionType))
  transactionType?: BankReconciliationTransactionType;

  @ApiPropertyOptional({
    description:
      "When true (default), only rows with no bank date and not dishonored. When false, rows with a bank date or dishonored.",
  })
  @BooleanQuery()
  @IsBoolean()
  @IsOptional()
  unclearedOnly?: boolean;
}
