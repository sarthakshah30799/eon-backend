import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class FinancialCodeListQueryDto {
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

  @ApiPropertyOptional({ description: "Global search across type, code, and name" })
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
