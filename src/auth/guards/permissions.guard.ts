import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from '../../users/user.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly userService: UserService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.session?.userId;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const userDto = await this.userService.findById(userId, userId);
    if (!userDto) {
      throw new UnauthorizedException('User profile not found');
    }

    const path = request.route?.path || request.url;
    const method = request.method;

    // 1. Allow profile/me and register to bypass
    if (path.endsWith('/register') || path.endsWith('/profile/me')) {
      return true;
    }

    // 2. Exclusive Check for Company, Branch, and Counter Profiles
    // Backend paths are: /companies, /branches, /counters
    const isCompanyRoute = path.includes('/companies');
    const isBranchRoute = path.includes('/branches');
    const isCounterRoute = path.includes('/counters');

    if (isCompanyRoute || isBranchRoute || isCounterRoute) {
      if (method === 'GET' && (isBranchRoute || isCounterRoute)) {
        return true;
      }
      if (!userDto.isAdmin) {
        throw new ForbiddenException(
          'Access to Company, Branch, and Counter profiles is restricted to the master administrator.',
        );
      }
      return true;
    }

    // 3. Users marked as admin always have absolute access to everything
    if (userDto.isAdmin) {
      return true;
    }

    // 4. Role-Based Access Control for other profiles
    let menuPath = '';
    if (path.includes('/roles')) {
      menuPath = '/admin/user-role';
    } else if (path.includes('/users')) {
      // Allow self-lookup (GET /users/:id matching logged-in user id)
      const isSelf = method === 'GET' && request.params.id === userId;
      if (isSelf) return true;
      menuPath = '/admin/user-profile';
    } else if (path.includes('/countries')) {
      menuPath = '/admin/country-profile';
    } else if (path.includes('/states')) {
      menuPath = '/admin/state-profile';
    } else if (path.includes('/products')) {
      menuPath = '/admin/product-profile';
    }

    if (!menuPath) {
      return true;
    }

    // Map HTTP Method to standard permission codes
    let requiredPermission = 'view';
    if (method === 'POST') {
      requiredPermission = 'add';
    } else if (method === 'PUT' || method === 'PATCH') {
      requiredPermission = 'modify';
    } else if (method === 'DELETE') {
      requiredPermission = 'delete';
    }

    const userPermissions = userDto.permissions?.[menuPath] || [];
    if (!userPermissions.includes(requiredPermission)) {
      throw new ForbiddenException(
        `You do not have permission to ${requiredPermission} on ${menuPath}`,
      );
    }

    return true;
  }
}
