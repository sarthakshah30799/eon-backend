import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";

export class FinancialSubProfileListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      "Global search across sub code, name, and parent financial fields",
  })
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
