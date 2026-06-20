import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString } from "class-validator";
import { ClientType } from "../corporate-client.entity";

export class CorporateClientListQueryDto {
  @ApiPropertyOptional({ description: "Search query by code, name, or city" })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: "Filter by Client Code" })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ description: "Filter by Client Name" })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: "Filter by Active status" })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  active?: boolean;

  @ApiPropertyOptional({ description: "Filter by Corporate Client type", enum: ClientType })
  @IsEnum(ClientType)
  @IsOptional()
  type?: ClientType;

  @ApiPropertyOptional({ description: "Page number", default: 1 })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: "Items per page", default: 10 })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
