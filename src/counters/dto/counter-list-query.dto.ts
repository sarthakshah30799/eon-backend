import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";
import { BooleanQuery } from "../../common/transformers/parse-boolean-query";

export class CounterListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      "Global search across counter no, name, branch code, and branch name",
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: "When true, return only active counters",
  })
  @IsBoolean()
  @IsOptional()
  @BooleanQuery()
  activeOnly?: boolean;

  @ApiPropertyOptional({ description: "Filter counters by branch ID" })
  @IsUUID()
  @IsOptional()
  branchId?: string;
}
