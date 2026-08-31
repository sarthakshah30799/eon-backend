import { SelectQueryBuilder } from "typeorm";
import {
  DEFAULT_PAGINATION_LIMIT,
  DEFAULT_PAGINATION_OFFSET,
  MAX_PAGINATION_LIMIT,
} from "./pagination.constants";

/**
 * Proper typed contract for pagination - replaces `any`/`unknown`.
 * All list APIs (e.g. ManualBillBookListQueryDto) implement this.
 */
export interface PaginationParams {
  limit?: number;
  offset?: number;
}

/**
 * Normalise raw pagination query into safe limit/offset values.
 * Applies defaults and clamps to allowed ranges so callers never have to repeat this logic.
 */
export function normalizePagination(query: PaginationParams = {}): {
  limit: number;
  offset: number;
} {
  const parse = (val: number | undefined, fallback: number): number => {
    if (val === undefined || val === null) return fallback;
    if (Number.isNaN(val)) return fallback;
    return val;
  };

  let limit = parse(query.limit, DEFAULT_PAGINATION_LIMIT);
  let offset = parse(query.offset, DEFAULT_PAGINATION_OFFSET);

  limit = Math.max(1, Math.min(limit, MAX_PAGINATION_LIMIT));
  offset = Math.max(0, offset);

  return { limit, offset };
}

/**
 * Apply limit/offset to a TypeORM QueryBuilder.
 * Reusable one-liner so every service can paginate consistently:
 *   applyPagination(qb, pagination);
 *   const [data, total] = await qb.getManyAndCount();
 */
export function applyPagination<T>(
  qb: SelectQueryBuilder<T>,
  pagination: { limit: number; offset: number },
): SelectQueryBuilder<T> {
  qb.skip(pagination.offset).take(pagination.limit);
  return qb;
}

/**
 * Raw query shape before ValidationPipe (strings from URL).
 * Used only for backwards-compat helper parsePaginationParams.
 */
export interface RawPaginationParams {
  limit?: string | number;
  offset?: string | number;
}

/**
 * Parse raw query strings (when not using DTO) into pagination values.
 * Kept for backwards-compat / non-DTO usage.
 */
export function parsePaginationParams(query: RawPaginationParams): {
  limit: number;
  offset: number;
} {
  const limit =
    query.limit !== undefined
      ? parseInt(String(query.limit), 10)
      : DEFAULT_PAGINATION_LIMIT;
  const offset =
    query.offset !== undefined
      ? parseInt(String(query.offset), 10)
      : DEFAULT_PAGINATION_OFFSET;
  return normalizePagination({
    limit: isNaN(limit) ? DEFAULT_PAGINATION_LIMIT : limit,
    offset: isNaN(offset) ? DEFAULT_PAGINATION_OFFSET : offset,
  });
}
