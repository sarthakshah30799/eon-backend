import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";

export class StateListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: "Global search across state code, name, and related codes",
  })
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
