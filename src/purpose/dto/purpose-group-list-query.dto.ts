import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination";
import { PurposeGroupProfileType } from "../purpose.enums";

export class PurposeGroupListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Search name or title" })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: PurposeGroupProfileType })
  @IsEnum(PurposeGroupProfileType)
  @IsOptional()
  profileType?: PurposeGroupProfileType;
}
