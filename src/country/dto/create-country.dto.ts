import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { CountryRiskCategory } from "../country.entity";

export class CreateCountryDto {
  @ApiProperty({ description: "Country code", example: "IN", maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;

  @ApiProperty({ description: "Country name", example: "India", maxLength: 250 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  name: string;

  @ApiPropertyOptional({ description: "LRS country code", maxLength: 20 })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  lrsCountryCode?: string;

  @ApiPropertyOptional({ description: "CTR country code", maxLength: 20 })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  ctrCountryCode?: string;

  @ApiPropertyOptional({
    description: "Risk category",
    enum: CountryRiskCategory,
    default: CountryRiskCategory.Low,
  })
  @IsEnum(CountryRiskCategory)
  @IsOptional()
  riskCategory?: CountryRiskCategory;

  @ApiPropertyOptional({ description: "Restricted country flag", default: false })
  @IsBoolean()
  @IsOptional()
  restrictedCountry?: boolean;

  @ApiPropertyOptional({ description: "Grey list country flag", default: false })
  @IsBoolean()
  @IsOptional()
  greyListCountry?: boolean;

  @ApiPropertyOptional({ description: "Base country flag", default: false })
  @IsBoolean()
  @IsOptional()
  baseCountry?: boolean;
}
