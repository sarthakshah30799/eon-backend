import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";

export class FinancialCodeListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: "Global search across type, code, and name",
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: "Filter by financial type" })
  @IsString()
  @IsOptional()
  financialType?: string;

  @ApiPropertyOptional({ description: "Filter by financial code" })
  @IsString()
  @IsOptional()
  financialCode?: string;

  @ApiPropertyOptional({ description: "Filter by financial name" })
  @IsString()
  @IsOptional()
  financialName?: string;
}
