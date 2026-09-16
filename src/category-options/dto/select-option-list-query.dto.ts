import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";

export class SelectOptionListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Search by category code" })
  @IsString()
  @IsOptional()
  search?: string;
}
