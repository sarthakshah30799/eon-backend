import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";

export class TdsProfileListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: "Global search across code, name, value, and sort order",
  })
  @IsString()
  @IsOptional()
  search?: string;
}
