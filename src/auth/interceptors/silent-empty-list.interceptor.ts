import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { DEFAULT_PAGINATION_LIMIT } from '../../common/pagination/pagination.constants';

type SilentEmptyResult =
  | { kind: 'array' }
  | { kind: 'paginated' };

@Injectable()
export class SilentEmptyListInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const silentEmptyResult = request?.silentEmptyResult as SilentEmptyResult | undefined;

    if (!silentEmptyResult) {
      return next.handle();
    }

    if (silentEmptyResult.kind === 'paginated') {
      return of({
        data: [],
        page: 1,
        limit: DEFAULT_PAGINATION_LIMIT,
        totalItems: 0,
        totalPages: 0,
      });
    }

    return of([]);
  }
}
