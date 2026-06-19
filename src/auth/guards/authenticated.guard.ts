import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class AuthenticatedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    if ((request as any).sessionExpired) {
      throw new UnauthorizedException('Session expired');
    }

    if (!request.session || !request.session.userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    
    return true;
  }
}
