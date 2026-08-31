import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";

export class SelectOptionListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Search by option code" })
  @IsString()
  @IsOptional()
  search?: string;
}
