import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";

export class CountryGroupListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Global search across code and name" })
  @IsString()
  @IsOptional()
  search?: string;
}
