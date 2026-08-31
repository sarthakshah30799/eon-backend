import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString, IsUUID } from "class-validator";
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
  @Transform(parseBooleanQuery)
  activeOnly?: boolean;

  @ApiPropertyOptional({ description: "Filter counters by branch ID" })
  @IsUUID()
  @IsOptional()
  branchId?: string;
}
