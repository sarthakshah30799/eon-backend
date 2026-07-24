import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from "class-validator";

export class CreateCountryGroupDto {
  @ApiProperty({ description: "Country group name", example: "Europe", maxLength: 250 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  name: string;

  @ApiPropertyOptional({ description: "Country group code", example: "EUROPE", maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  code?: string;

  @ApiPropertyOptional({ description: "Sell limit amount", example: 1000000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  sellLimitAmount?: number;

  @ApiPropertyOptional({ description: "Sell limit currency UUID" })
  @IsUUID()
  @IsOptional()
  sellLimitCurrencyId?: string;

  @ApiPropertyOptional({ description: "Minimum travel days", example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  minTravelDays?: number;

  @ApiPropertyOptional({ description: "Maximum travel days", example: 30 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  maxTravelDays?: number;
}
