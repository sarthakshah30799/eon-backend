import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

export class HonourAdvanceRefundDto {
  @ApiProperty({ description: "HO Paying Bank Account Profile ID (UUID)" })
  @IsUUID()
  @IsNotEmpty()
  hoPayingBankAccountId: string;

  @ApiPropertyOptional({ description: "HO Counter ID (UUID)" })
  @IsUUID()
  @IsOptional()
  counterId?: string;

  @ApiPropertyOptional({ description: "Transaction date in HO (YYYY-MM-DD)" })
  @IsDateString()
  @IsOptional()
  transactionDate?: string;

  @ApiPropertyOptional({ description: "Optional remarks or updated narration" })
  @IsString()
  @IsOptional()
  narration?: string;

  @ApiPropertyOptional({ description: "Cheque Number if paid via cheque" })
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
}
