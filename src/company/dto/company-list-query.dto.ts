import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";

export class CompanyListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: "Global search across company name, code, PAN, CIN, and email",
  })
  @IsString()
  @IsOptional()
  search?: string;
}
