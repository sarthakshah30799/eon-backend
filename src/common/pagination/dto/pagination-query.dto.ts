import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

/**
 * Reusable pagination query DTO.
 * FE sends `limit` (page size) and `offset` (items to skip) as URL query params.
 * Every list API can extend this class to inherit pagination behaviour.
 *
 * Example: GET /manual-bill-books/dispatches?limit=20&offset=40&status=PENDING&search=MB26
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: "Number of items to return",
    default: 10,
    minimum: 1,
    maximum: 100,
    type: Number,
  })
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = parseInt(String(value), 10);
    return isNaN(parsed) ? undefined : parsed;
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({
    description: "Number of items to skip (offset-based pagination)",
    default: 0,
    minimum: 0,
    type: Number,
  })
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = parseInt(String(value), 10);
    return isNaN(parsed) ? undefined : parsed;
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  offset?: number = 0;
}
