import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type, Transform } from "class-transformer";
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { CountryRiskCategory } from "../country.entity";

const parseBoolean = ({ value }: { value: unknown }) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
};

export class CountryListQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({ description: "Global search across code, name, and regulatory codes" })
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

  @ApiPropertyOptional({ description: "Filter by risk category", enum: CountryRiskCategory })
  @IsEnum(CountryRiskCategory)
  @IsOptional()
  riskCategory?: CountryRiskCategory;

  @ApiPropertyOptional({ description: "Filter restricted countries" })
  @Transform(parseBoolean)
  @IsBoolean()
  @IsOptional()
  restrictedCountry?: boolean;

  @ApiPropertyOptional({ description: "Filter grey list countries" })
  @Transform(parseBoolean)
  @IsBoolean()
  @IsOptional()
  greyListCountry?: boolean;

  @ApiPropertyOptional({ description: "Filter base countries" })
  @Transform(parseBoolean)
  @IsBoolean()
  @IsOptional()
  baseCountry?: boolean;
}
