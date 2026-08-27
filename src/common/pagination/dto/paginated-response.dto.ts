import { ApiProperty } from "@nestjs/swagger";

/**
 * Generic paginated wrapper returned by every paginated list endpoint.
 * Keeps the contract identical across all resources so FE can reuse a single handler.
 */
export class PaginatedResponseDto<T> {
  @ApiProperty({ isArray: true })
  data: T[];

  @ApiProperty({ description: "Total number of items matching the filters (before pagination)" })
  total: number;

  @ApiProperty({ description: "Limit used for this request" })
  limit: number;

  @ApiProperty({ description: "Offset used for this request" })
  offset: number;

  @ApiProperty({ description: "Whether more items exist beyond this page" })
  hasMore: boolean;
}

/**
 * Helper to build a paginated response object.
 * Usage:
 *   return buildPaginatedResponse(data, total, pagination);
 */
export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  pagination: { limit: number; offset: number },
): PaginatedResponseDto<T> {
  const { limit, offset } = pagination;
  return {
    data,
    total,
    limit,
    offset,
    hasMore: offset + data.length < total,
  };
}
