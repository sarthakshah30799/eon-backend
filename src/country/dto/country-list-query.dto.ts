import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";
import { BooleanQuery } from "../../common/transformers/parse-boolean-query";
import { CountryRiskCategory } from "../country.entity";

export class CountryListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: "Global search across code, name, and regulatory codes",
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: "Filter by country code" })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ description: "Filter by country name" })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: "Filter by risk category",
    enum: CountryRiskCategory,
  })
  @IsEnum(CountryRiskCategory)
  @IsOptional()
  riskCategory?: CountryRiskCategory;

  @ApiPropertyOptional({ description: "Filter restricted countries" })
  @BooleanQuery()
  @IsBoolean()
  @IsOptional()
  restrictedCountry?: boolean;

  @ApiPropertyOptional({ description: "Filter grey list countries" })
  @BooleanQuery()
  @IsBoolean()
  @IsOptional()
  greyListCountry?: boolean;

  @ApiPropertyOptional({ description: "Filter base countries" })
  @BooleanQuery()
  @IsBoolean()
  @IsOptional()
  baseCountry?: boolean;

  @ApiPropertyOptional({
    description: "Hide blocked countries unless an override exists",
  })
  @BooleanQuery()
  @IsBoolean()
  @IsOptional()
  hideBlockedCountry?: boolean;

  @ApiPropertyOptional({ description: "Hide restricted countries" })
  @BooleanQuery()
  @IsBoolean()
  @IsOptional()
  hideRestrictedCountry?: boolean;

  @ApiPropertyOptional({ description: "Hide base countries" })
  @BooleanQuery()
  @IsBoolean()
  @IsOptional()
  hideBaseCountry?: boolean;
}
