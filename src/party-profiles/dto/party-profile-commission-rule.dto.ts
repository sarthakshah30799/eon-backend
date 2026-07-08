import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import {
  PartyProfileCommissionTypeEnum,
  type PartyProfileCommissionType,
} from "../types/party-profile-commission-rule.types";

export class PartyProfileCommissionRuleDto {
  @ApiProperty({ description: "Currency code", example: "USD" })
  @IsString()
  @IsNotEmpty()
  currencyCode: string;

  @ApiPropertyOptional({ description: "Currency name" })
  @IsString()
  @IsOptional()
  currencyName?: string | null;

  @ApiProperty({ description: "Product code", example: "MOBILE" })
  @IsString()
  @IsNotEmpty()
  productCode: string;

  @ApiPropertyOptional({ description: "Product description" })
  @IsString()
  @IsOptional()
  productDescription?: string | null;

  @ApiProperty({ enum: PartyProfileCommissionTypeEnum })
  @IsEnum(PartyProfileCommissionTypeEnum)
  commissionType: PartyProfileCommissionType;

  @ApiProperty({ description: "Commission value", example: "1.25" })
  @IsString()
  @IsNotEmpty()
  commissionValue: string;
}
