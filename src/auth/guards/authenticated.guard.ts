import { Injectable, CanActivate, ExecutionContext, Logger, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class AuthenticatedGuard implements CanActivate {
  private readonly logger = new Logger(AuthenticatedGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    this.logger.log(
      `[DEBUG] authenticated guard method=${request.method} path=${request.originalUrl ?? request.url} userId=${request.session?.userId ?? 'null'} sessionExpired=${Boolean((request as any).sessionExpired)}`
    );

    if ((request as any).sessionExpired) {
      this.logger.warn(
        `[DEBUG] authenticated guard rejecting expired session method=${request.method} path=${request.originalUrl ?? request.url}`
      );
      throw new UnauthorizedException('Session expired');
    }

    if (!request.session || !request.session.userId) {
      this.logger.warn(
        `[DEBUG] authenticated guard rejecting unauthenticated request method=${request.method} path=${request.originalUrl ?? request.url}`
      );
      throw new UnauthorizedException('User not authenticated');
    }
    
    this.logger.log(
      `[DEBUG] authenticated guard allowed method=${request.method} path=${request.originalUrl ?? request.url} userId=${request.session.userId}`
    );
    return true;
  }
}
