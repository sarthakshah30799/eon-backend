import { SelectQueryBuilder } from "typeorm";
import { PaginationQueryDto } from "./dto/pagination-query.dto";

/**
 * Normalise raw pagination query into safe limit/offset values.
 * Applies defaults and clamps to allowed ranges so callers never have to repeat this logic.
 */
export function normalizePagination(query: PaginationQueryDto | Record<string, any>): { limit: number; offset: number } {
  const parse = (val: any, fallback: number) => {
    if (val === undefined || val === null || val === '') return fallback;
    const num = typeof val === 'number' ? val : parseInt(String(val), 10);
    if (isNaN(num)) return fallback;
    return num;
  };

  let limit = parse((query as any).limit, 10);
  let offset = parse((query as any).offset, 0);

  limit = Math.max(1, Math.min(limit, 100));
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
 * Parse raw query strings (when not using DTO) into pagination values.
 * Kept for backwards-compat / non-DTO usage.
 */
export function parsePaginationParams(query: Record<string, any>): { limit: number; offset: number } {
  const limit = query.limit !== undefined ? parseInt(String(query.limit), 10) : 10;
  const offset = query.offset !== undefined ? parseInt(String(query.offset), 10) : 0;
  return normalizePagination({
    limit: isNaN(limit) ? 10 : limit,
    offset: isNaN(offset) ? 0 : offset,
  });
}
