import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from '../../users/user.service';
import { toPartyProfileMenuPath } from '../../party-profiles/party-profile-path.util';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private readonly userService: UserService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.session?.userId;
    this.logger.log(
      `[DEBUG] permissions guard start method=${request.method} path=${request.originalUrl ?? request.url} userId=${userId ?? 'null'} activeBranchId=${request.session?.activeBranchId ?? 'null'} activeCounterId=${request.session?.activeCounterId ?? 'null'}`
    );
    if (!userId) {
      this.logger.warn(
        `[DEBUG] permissions guard rejecting unauthenticated request method=${request.method} path=${request.originalUrl ?? request.url}`
      );
      throw new UnauthorizedException('User not authenticated');
    }

    const userDto = await this.userService.findById(userId, userId, {
      activeBranchId: request.session?.activeBranchId ?? null,
      activeCounterId: request.session?.activeCounterId ?? null,
    });
    if (!userDto) {
      this.logger.warn(
        `[DEBUG] permissions guard rejecting missing user profile method=${request.method} path=${request.originalUrl ?? request.url} userId=${userId}`
      );
      throw new UnauthorizedException('User profile not found');
    }

    const path = request.route?.path || request.url;
    const method = request.method;

    // 1. Allow profile/me and register to bypass
    if (path.endsWith('/register') || path.endsWith('/profile/me')) {
      this.logger.log(
        `[DEBUG] permissions guard allow bypass route method=${method} path=${path} userId=${userId}`
      );
      return true;
    }

    // 2. Exclusive Check for Company, Branch, and Counter Profiles
    // Backend paths are: /companies, /branches, /counters
    const isCompanyRoute = path.includes('/companies');
    const isBranchRoute = path.includes('/branches');
    const isCounterRoute = path.includes('/counters');

    if (isCompanyRoute || isBranchRoute || isCounterRoute) {
      if (method === 'GET' && (isBranchRoute || isCounterRoute)) {
        this.logger.log(
          `[DEBUG] permissions guard allow reference GET method=${method} path=${path} userId=${userId}`
        );
        return true;
      }
      if (!userDto.isAdmin) {
        this.logger.warn(
          `[DEBUG] permissions guard deny master-admin route method=${method} path=${path} userId=${userId}`
        );
        throw new ForbiddenException(
          'Access to Company, Branch, and Counter profiles is restricted to the master administrator.',
        );
      }
      this.logger.log(
        `[DEBUG] permissions guard allow master-admin route method=${method} path=${path} userId=${userId}`
      );
      return true;
    }

    if (method === 'GET' && path.includes('/roles') && !path.includes('/permissions')) {
      this.logger.log(
        `[DEBUG] permissions guard allow roles GET method=${method} path=${path} userId=${userId}`
      );
      return true;
    }

    // 3. Users marked as admin or HO staff always have absolute access to everything
    if (userDto.isAdmin || userDto.isHoStaff) {
      this.logger.log(
        `[DEBUG] permissions guard allow full-access user method=${method} path=${path} userId=${userId} isAdmin=${Boolean(userDto.isAdmin)} isHoStaff=${Boolean(userDto.isHoStaff)}`
      );
      return true;
    }

    const activeBranchId = request.session?.activeBranchId;
    const activeCounterId = request.session?.activeCounterId;
    if (!activeBranchId || !activeCounterId) {
      this.logger.warn(
        `[DEBUG] permissions guard deny missing workplace method=${method} path=${path} userId=${userId} activeBranchId=${activeBranchId ?? 'null'} activeCounterId=${activeCounterId ?? 'null'}`
      );
      throw new ForbiddenException('Workplace not selected');
    }

    // 4. Role-Based Access Control for other profiles
    let menuPath = '';
    let allowedMenuPaths: string[] | null = null;
    if (path.includes('/roles')) {
      menuPath = '/admin/user-role';
    } else if (path.includes('/manual-bill-books')) {
      menuPath = '/manual-bill-books';
    } else if (path.includes('/chequebooks')) {
      menuPath = '/cheque-books';
      allowedMenuPaths = ['/cheque-books', '/admin/chequebooks'];
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
        this.logger.log(
          `[DEBUG] permissions guard allow document profiles GET method=${method} path=${path} userId=${userId}`
        );
        return true;
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

      const requestedTypes = Array.isArray(requestedType)
        ? requestedType
        : String(requestedType)
            .split(',')
            .map(type => type.trim())
            .filter(Boolean);
      const requestedMenuPaths = requestedTypes
        .map(type => toPartyProfileMenuPath(type))
        .filter((menuPath): menuPath is string => Boolean(menuPath));

      if (requestedMenuPaths.length === 0) {
        return true;
      }

      const requiredPermission = method === 'POST'
        ? 'add'
        : method === 'PUT' || method === 'PATCH'
          ? 'modify'
          : method === 'DELETE'
            ? 'delete'
            : 'view';

      const hasAnyRequestedPermission = requestedMenuPaths.some(requestedMenuPath =>
        (userDto.permissions?.[requestedMenuPath] || []).includes(requiredPermission)
      );

      if (!hasAnyRequestedPermission) {
        this.logger.warn(
          `[DEBUG] permissions guard deny party profiles method=${method} path=${path} requestedMenuPaths=${JSON.stringify(requestedMenuPaths)} requiredPermission=${requiredPermission} userPermissions=${JSON.stringify(userDto.permissions)} userId=${userId}`
        );
        if (method === 'GET' && !request.params?.id) {
          request.silentEmptyResult = this.resolveSilentEmptyResult(path, requestedMenuPaths[0]);
          if (request.silentEmptyResult) {
            this.logger.warn(
              `[DEBUG] permissions guard allowing silent empty result method=${method} path=${path} menuPath=${requestedMenuPaths[0]} userId=${userId}`
            );
            return true;
          }
        }

        throw new NotFoundException(`Resource at ${requestedMenuPaths[0]} not found`);
      }

      this.logger.log(
        `[DEBUG] permissions guard allow party profiles method=${method} path=${path} requestedMenuPaths=${JSON.stringify(requestedMenuPaths)} requiredPermission=${requiredPermission} userId=${userId}`
      );
      return true;
    }

    if (menuPath.startsWith('/admin/')) {
      if (method === 'GET') {
        this.logger.log(
          `[DEBUG] permissions guard allow admin view method=${method} path=${path} menuPath=${menuPath} userId=${userId}`
        );
        return true;
      }

      if (!userDto.isAdmin) {
        this.logger.warn(
          `[DEBUG] permissions guard deny admin modify method=${method} path=${path} menuPath=${menuPath} userId=${userId}`
        );
        throw new NotFoundException(`Resource at ${menuPath} not found`);
      }
    }

    if (!menuPath) {
      this.logger.log(
        `[DEBUG] permissions guard allow unmapped route method=${method} path=${path} userId=${userId}`
      );
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

    const permissionPaths = allowedMenuPaths?.length ? allowedMenuPaths : [menuPath];
    const hasPermission = permissionPaths.some(permissionPath =>
      (userDto.permissions?.[permissionPath] || []).includes(requiredPermission)
    );
    if (!hasPermission) {
      this.logger.warn(
        `[DEBUG] permissions guard deny permission method=${method} path=${path} menuPath=${menuPath} requiredPermission=${requiredPermission} allowedMenuPaths=${JSON.stringify(permissionPaths)} userPermissions=${JSON.stringify(userDto.permissions)} userId=${userId}`
      );
      if (method === 'GET' && !request.params?.id) {
        request.silentEmptyResult = this.resolveSilentEmptyResult(path, menuPath);
        if (request.silentEmptyResult) {
          this.logger.warn(
            `[DEBUG] permissions guard allowing silent empty result method=${method} path=${path} menuPath=${menuPath} userId=${userId}`
          );
          return true;
        }
      }

      throw new NotFoundException(`Resource at ${menuPath} not found`);
    }

    this.logger.log(
      `[DEBUG] permissions guard allow method=${method} path=${path} menuPath=${menuPath} requiredPermission=${requiredPermission} allowedMenuPaths=${JSON.stringify(permissionPaths)} userId=${userId}`
    );
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
