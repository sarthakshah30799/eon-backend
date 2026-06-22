import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString } from "class-validator";
import { ClientType } from "../party-profile.entity";

export class PartyProfileListQueryDto {
  @ApiPropertyOptional({ description: "Search query by code, name, or city" })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: "Filter by Party Profile code" })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ description: "Filter by Party Profile name" })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: "Filter by Active status" })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  active?: boolean;

  @ApiPropertyOptional({ description: "Filter by Party Profile type", enum: ClientType })
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
