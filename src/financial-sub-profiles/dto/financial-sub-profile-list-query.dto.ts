import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min, IsUUID } from "class-validator";

export class FinancialSubProfileListQueryDto {
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

  @ApiPropertyOptional({ description: "Global search across sub code, name, and parent financial fields" })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: "Filter by parent financial code UUID" })
  @IsUUID()
  @IsOptional()
  financialCodeId?: string;

  @ApiPropertyOptional({ description: "Filter by financial sub code" })
  @IsString()
  @IsOptional()
  financialSubCode?: string;

  @ApiPropertyOptional({ description: "Filter by financial sub name" })
  @IsString()
  @IsOptional()
  financialSubName?: string;
}
