import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString } from "class-validator";
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

  @ApiPropertyOptional({ description: "Filter by one or more Party Profile types", enum: ClientType, isArray: true })
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const values = Array.isArray(value) ? value : String(value).split(',');
    return values
      .map(item => String(item).trim())
      .filter(Boolean);
  })
  @IsArray()
  @IsEnum(ClientType, { each: true })
  @IsOptional()
  type?: ClientType[];

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
