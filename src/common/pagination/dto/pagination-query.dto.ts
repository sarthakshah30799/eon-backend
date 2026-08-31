import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";
import {
  DEFAULT_PAGINATION_LIMIT,
  DEFAULT_PAGINATION_OFFSET,
  MAX_PAGINATION_LIMIT,
} from "../pagination.constants";
import type { PaginationParams } from "../pagination.util";

/**
 * Reusable pagination query DTO.
 * FE sends `limit` (page size) and `offset` (items to skip) as URL query params.
 * Every list API can extend this class to inherit pagination behaviour.
 *
 * Example: GET /manual-bill-books/dispatches?limit=20&offset=40&status=PENDING&search=MB26
 */
export class PaginationQueryDto implements PaginationParams {
  @ApiPropertyOptional({
    description: "Number of items to return",
    default: DEFAULT_PAGINATION_LIMIT,
    minimum: 1,
    maximum: MAX_PAGINATION_LIMIT,
    type: Number,
  })
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === "") return undefined;
    const parsed = parseInt(String(value), 10);
    return isNaN(parsed) ? undefined : parsed;
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGINATION_LIMIT)
  @IsOptional()
  limit?: number = DEFAULT_PAGINATION_LIMIT;

  @ApiPropertyOptional({
    description: "Number of items to skip (offset-based pagination)",
    default: DEFAULT_PAGINATION_OFFSET,
    minimum: 0,
    type: Number,
  })
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === "") return undefined;
    const parsed = parseInt(String(value), 10);
    return isNaN(parsed) ? undefined : parsed;
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  offset?: number = DEFAULT_PAGINATION_OFFSET;
}
