import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";
import { BooleanQuery } from "../../common/transformers/parse-boolean-query";

export class ProductListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: "Filter products available in retail buying",
  })
  @IsBoolean()
  @IsOptional()
  @BooleanQuery()
  retailBuying?: boolean;

  @ApiPropertyOptional({
    description: "Filter products available in retail selling",
  })
  @IsBoolean()
  @IsOptional()
  @BooleanQuery()
  retailSelling?: boolean;

  @ApiPropertyOptional({ description: "Filter products available in bulk buying" })
  @IsBoolean()
  @IsOptional()
  @BooleanQuery()
  bulkBuying?: boolean;

  @ApiPropertyOptional({
    description: "Filter products available in bulk selling",
  })
  @IsBoolean()
  @IsOptional()
  @BooleanQuery()
  bulkSelling?: boolean;

  @ApiPropertyOptional({
    description: "Filter products available in other transactions",
  })
  @IsBoolean()
  @IsOptional()
  @BooleanQuery()
  otherTransaction?: boolean;

  @ApiPropertyOptional({
    description: "Filter products available in deal cover",
  })
  @IsBoolean()
  @IsOptional()
  @BooleanQuery()
  dealCover?: boolean;

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
  @BooleanQuery()
  activeOnly?: boolean;
}
