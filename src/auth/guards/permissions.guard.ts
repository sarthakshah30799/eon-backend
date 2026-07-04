import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
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

    const userDto = await this.userService.findById(userId, userId, {
      activeBranchId: request.session?.activeBranchId ?? null,
      activeCounterId: request.session?.activeCounterId ?? null,
    });
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

    if (method === 'GET' && path.includes('/roles') && !path.includes('/permissions')) {
      return true;
    }

    // 3. Users marked as admin or HO staff always have absolute access to everything
    if (userDto.isAdmin || userDto.isHoStaff) {
      return true;
    }

    const activeBranchId = request.session?.activeBranchId;
    const activeCounterId = request.session?.activeCounterId;
    if (!activeBranchId || !activeCounterId) {
      throw new ForbiddenException('Workplace not selected');
    }

    // 4. Role-Based Access Control for other profiles
    let menuPath = '';
    if (path.includes('/roles')) {
      menuPath = '/admin/user-role';
    } else if (path.includes('/users')) {
      // Allow self-lookup (GET /users/:id matching logged-in user id)
      const isSelf = method === 'GET' && request.params.id === userId;
      if (isSelf) return true;
      menuPath = '/user-profile';
    } else if (path.includes('/countries')) {
      menuPath = '/admin/country-profile';
    } else if (path.includes('/states')) {
      // States are reference data - allow all authenticated users to GET
      if (method === 'GET') {
        return true;
      }
      menuPath = '/admin/state-profile';
    } else if (path.includes('/products')) {
      menuPath = '/admin/product-profile';
    } else if (path.includes('/document-profiles')) {
      if (method === 'GET') {
        if (userDto.isAdmin) {
          return true;
        }
        throw new ForbiddenException(
          'Access to document profiles is restricted to administrators.',
        );
      }
      menuPath = '/admin/document-profile';
    } else if (path.includes('/tds-profiles')) {
      menuPath = '/admin/tds-profile';
    } else if (path.includes('/party-profiles')) {
      if (path.endsWith('/types') || path.endsWith('/review-queue')) {
        return true;
      }

      const requestedType = request.query?.type || request.body?.type;
      if (!requestedType) {
        return true;
      }

      menuPath = `/party-profiles/${String(requestedType).trim().toLowerCase().replace(/_/g, '-')}`;
    } else if (path.includes('/manual-bill-books')) {
      menuPath = '/manual-bill-books';
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
      if (method === 'GET' && !request.params?.id) {
        request.silentEmptyResult = this.resolveSilentEmptyResult(path, menuPath);
        if (request.silentEmptyResult) {
          return true;
        }
      }

      throw new NotFoundException(`Resource at ${menuPath} not found`);
    }

    return true;
  }

  private resolveSilentEmptyResult(
    path: string,
    menuPath: string,
  ): { kind: 'array' } | { kind: 'paginated' } | null {
    const arrayPathMatches = [
      '/roles',
      '/users',
      '/user-profile',
      '/products',
      '/document-profiles',
      '/admin/user-role',
      '/admin/product-profile',
      '/admin/document-profile',
      '/admin/tds-profile',
      '/tds-profiles',
    ];

    const paginatedPathMatches = [
      '/countries',
      '/states',
      '/country-profile',
      '/state-profile',
      '/admin/country-profile',
      '/admin/state-profile',
      '/account-profiles',
      '/financial-codes',
    ];

    if (
      arrayPathMatches.some(token => path.includes(token) || menuPath.includes(token))
    ) {
      return { kind: 'array' };
    }

    if (
      paginatedPathMatches.some(token => path.includes(token) || menuPath.includes(token)) ||
      menuPath.startsWith('/party-profiles/')
    ) {
      return { kind: 'paginated' };
    }

    return null;
  }
}
