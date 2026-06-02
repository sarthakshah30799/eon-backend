import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type, Transform } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min, IsUUID } from "class-validator";

const parseBoolean = ({ value }: { value: unknown }) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
};

export class StateListQueryDto {
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

  @ApiPropertyOptional({ description: "Global search across state code, name, and related codes" })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: "Filter by country ID (UUID)" })
  @IsUUID()
  @IsOptional()
  countryId?: string;

  @ApiPropertyOptional({ description: "Filter by state code" })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ description: "Filter by state name" })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: "Filter by GST state code" })
  @IsString()
  @IsOptional()
  gstStateCode?: string;

  @ApiPropertyOptional({ description: "Filter by CTR state code" })
  @IsString()
  @IsOptional()
  ctrStateCode?: string;
}
