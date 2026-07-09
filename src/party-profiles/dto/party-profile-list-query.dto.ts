import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString } from "class-validator";
import { ClientType } from "../party-profile.entity";

const parseBooleanQuery = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  return undefined;
};

const parseNumberQuery = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

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
  @Transform(parseBooleanQuery)
  active?: boolean;

  @ApiPropertyOptional({ description: "When false, include inactive party profiles" })
  @IsBoolean()
  @IsOptional()
  @Transform(parseBooleanQuery)
  activeOnly?: boolean;

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

  @ApiPropertyOptional({ description: "Filter by sale-enabled party profiles" })
  @IsBoolean()
  @IsOptional()
  @Transform(parseBooleanQuery)
  sale?: boolean;

  @ApiPropertyOptional({ description: "Filter by purchase-enabled party profiles" })
  @IsBoolean()
  @IsOptional()
  @Transform(parseBooleanQuery)
  purchase?: boolean;

  @ApiPropertyOptional({ description: "Page number", default: 1 })
  @IsInt()
  @IsOptional()
  @Transform(parseNumberQuery)
  page?: number;

  @ApiPropertyOptional({ description: "Items per page", default: 10 })
  @IsInt()
  @IsOptional()
  @Transform(parseNumberQuery)
  limit?: number;
}
