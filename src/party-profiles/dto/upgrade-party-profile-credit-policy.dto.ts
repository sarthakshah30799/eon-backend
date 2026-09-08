import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsNumber, IsOptional, Min } from "class-validator";

export class UpgradePartyProfileCreditPolicyDto {
  @ApiPropertyOptional({ description: "Permanent Credit Limit", example: 1000000 })
  @IsNumber()
  @Min(-1)
  @IsOptional()
  permanentCreditLimit?: number;

  @ApiPropertyOptional({ description: "Permanent Credit Days", example: 30 })
  @IsInt()
  @Min(-1)
  @IsOptional()
  permanentCreditDays?: number;

  @ApiPropertyOptional({ description: "Temporary Credit Limit", example: 100000 })
  @IsNumber()
  @Min(-1)
  @IsOptional()
  temporaryCreditLimit?: number;

  @ApiPropertyOptional({ description: "Temporary Credit Days", example: 7 })
  @IsInt()
  @Min(-1)
  @IsOptional()
  temporaryCreditDays?: number;

  @ApiPropertyOptional({ description: "Cheque Transaction Limit", example: 500000 })
  @IsNumber()
  @Min(-1)
  @IsOptional()
  chqTrxnLimit?: number;
}
