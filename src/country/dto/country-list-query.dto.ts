import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsEnum, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";
import { CountryRiskCategory } from "../country.entity";

const parseBoolean = ({ value }: { value: unknown }) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
};

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

  @ApiPropertyOptional({
    description: "Hide blocked countries unless an override exists",
  })
  @Transform(parseBoolean)
  @IsBoolean()
  @IsOptional()
  hideBlockedCountry?: boolean;

  @ApiPropertyOptional({ description: "Hide restricted countries" })
  @Transform(parseBoolean)
  @IsBoolean()
  @IsOptional()
  hideRestrictedCountry?: boolean;

  @ApiPropertyOptional({ description: "Hide base countries" })
  @Transform(parseBoolean)
  @IsBoolean()
  @IsOptional()
  hideBaseCountry?: boolean;
}
