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

export class UserListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: "When false, include inactive users. Default true.",
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(parseBooleanQuery)
  activeOnly?: boolean;

  @ApiPropertyOptional({
    description: "Global search across code, name, email, contact, designation",
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: "Filter by role flag (CASHIER or DELIVERY_BOY)",
  })
  @IsString()
  @IsOptional()
  roleFilter?: string;

  @ApiPropertyOptional({
    description:
      "Filter by branch ID (admin/HO only; branch users are scoped to their active branch)",
  })
  @IsUUID()
  @IsOptional()
  branchId?: string;
}
