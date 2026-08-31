import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";

const parseBooleanQuery = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  return undefined;
};

export class ProductListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Filter products available in bulk buying" })
  @IsBoolean()
  @IsOptional()
  @Transform(parseBooleanQuery)
  bulkBuying?: boolean;

  @ApiPropertyOptional({
    description: "Filter products available in bulk selling",
  })
  @IsBoolean()
  @IsOptional()
  @Transform(parseBooleanQuery)
  bulkSelling?: boolean;

  @ApiPropertyOptional({
    description: "Filter products available in other transactions",
  })
  @IsBoolean()
  @IsOptional()
  @Transform(parseBooleanQuery)
  otherTransaction?: boolean;

  @ApiPropertyOptional({
    description: "Global search across product code and description",
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: "When false, include inactive products. Default true.",
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(parseBooleanQuery)
  activeOnly?: boolean;
}
