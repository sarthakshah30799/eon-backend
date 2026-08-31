import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";

export class RoleListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Global search across role code and name" })
  @IsString()
  @IsOptional()
  search?: string;
}
