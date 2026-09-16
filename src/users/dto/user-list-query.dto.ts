import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";
import { BooleanQuery } from "../../common/transformers/parse-boolean-query";

export class UserListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: "When false, include inactive users. Default true.",
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  @BooleanQuery()
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
