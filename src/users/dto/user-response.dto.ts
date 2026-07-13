import { User } from '../user.entity';
import { ApiProperty } from '@nestjs/swagger';
import { normalizeMenuPath } from '../../menu/menu-path.util';
import { UserAssignmentResponseDto } from './user-assignment.dto';

type WorkplaceSelection = {
  activeBranchId?: string | null;
  activeCounterId?: string | null;
};

export class UserResponseDto {
  @ApiProperty({ description: 'User ID (UUID)' })
  id: string;

  @ApiProperty({ description: 'User Code', example: 'USR-001' })
  code: string;

  @ApiProperty({ description: 'User Name', example: 'Sarthak Kumar' })
  name: string;

  @ApiProperty({ description: 'Contact No', required: false })
  contactNo: string;

  @ApiProperty({ description: 'Email', example: 'user@example.com' })
  email: string;

  @ApiProperty({ description: 'Employee No', required: false })
  employeeNo: string;

  @ApiProperty({ description: 'Designation', required: false })
  designation: string;

  @ApiProperty({ description: 'User Lic No', required: false })
  userLicNo: string;

  @ApiProperty({ description: 'Is Active' })
  isActive: boolean;

  @ApiProperty({ description: 'Last Login Date', required: false })
  lastLoginDate: Date;

  @ApiProperty({ description: 'Is Locked' })
  isLocked: boolean;

  @ApiProperty({ description: 'Is Dormant' })
  isDormant: boolean;

  @ApiProperty({ description: 'Account creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  @ApiProperty({ description: 'Role ID (UUID)', required: false })
  roleId?: string;

  @ApiProperty({ description: 'Role name', required: false })
  roleName?: string;

  @ApiProperty({ description: 'Branch ID (UUID)', required: false })
  branchId?: string;

  @ApiProperty({ description: 'Branch name', required: false })
  branchName?: string;

  @ApiProperty({ description: 'Counter ID (UUID)', required: false })
  counterId?: string;

  @ApiProperty({ description: 'Counter No.', required: false })
  counterNo?: number;

  @ApiProperty({ description: 'Counter Name', required: false })
  counterName?: string;

  @ApiProperty({ description: 'Assignments', required: false, type: [UserAssignmentResponseDto] })
  assignments?: UserAssignmentResponseDto[];

  @ApiProperty({ description: 'Permissions map', required: false })
  permissions?: Record<string, string[]>;

  @ApiProperty({ description: 'Is Admin User', required: false })
  isAdmin?: boolean;

  @ApiProperty({ description: 'Is HO Staff User', required: false })
  isHoStaff?: boolean;

  @ApiProperty({ description: 'Is Cashier', required: false })
  isCashier?: boolean;

  @ApiProperty({ description: 'Is Delivery Boy', required: false })
  isDeliveryBoy?: boolean;

  @ApiProperty({ description: 'Must change password on next login', required: false })
  mustChangePassword?: boolean;

  static fromEntity(user: User, workplace?: WorkplaceSelection): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.code = user.code;
    dto.name = user.name;
    dto.contactNo = user.contactNo;
    dto.email = user.email;
    dto.employeeNo = user.employeeNo;
    dto.designation = user.designation;
    dto.userLicNo = user.userLicNo;
    dto.isActive = user.isActive;
    dto.lastLoginDate = user.lastLoginDate;
    dto.isLocked = user.isLocked;
    dto.isDormant = user.isDormant;
    dto.isAdmin = user.isAdmin || false;
    dto.isHoStaff = user.userRoles?.some(userRole => userRole.role?.isHoStaff) || false;
    dto.isCashier = user.userRoles?.some(userRole => userRole.role?.isCashier) || false;
    dto.isDeliveryBoy = user.userRoles?.some(userRole => userRole.role?.isDeliveryBoy) || false;
    dto.mustChangePassword = user.mustChangePassword;
    dto.createdAt = user.createdAt;
    dto.updatedAt = user.updatedAt;

    const permissions: Record<string, string[]> = {};
    const firstUserRole = user.userRoles?.[0];
    const activeUserRole =
      workplace?.activeBranchId && workplace?.activeCounterId
        ? user.userRoles?.find(
            userRole =>
              userRole.branch?.id === workplace.activeBranchId &&
              userRole.counter?.id === workplace.activeCounterId,
          )
        : undefined;
    const resolvedUserRole = activeUserRole ?? firstUserRole;

    if (resolvedUserRole) {
      dto.roleId = resolvedUserRole.role?.id || null;
      dto.roleName = resolvedUserRole.role?.name || null;
      dto.branchId = resolvedUserRole.branch?.id || null;
      dto.branchName = resolvedUserRole.branch?.name || null;
      dto.counterId = resolvedUserRole.counter?.id || null;
      dto.counterNo = resolvedUserRole.counter?.counterNo || null;
      dto.counterName = resolvedUserRole.counter?.name || null;
    }

    dto.assignments = user.userRoles?.map(userRole => ({
      roleId: userRole.role?.id || '',
      roleName: userRole.role?.name || '',
      branchId: userRole.branch?.id || '',
      branchName: userRole.branch?.name || '',
      counterId: userRole.counter?.id || '',
      counterName: userRole.counter?.name || '',
    })) || [];

    if (resolvedUserRole?.role?.menuPermissions) {
      for (const mp of resolvedUserRole.role.menuPermissions) {
        if (mp.menu && mp.permission) {
          const menuPath = normalizeMenuPath(mp.menu.path) || mp.menu.name;
          if (!permissions[menuPath]) {
            permissions[menuPath] = [];
          }
          permissions[menuPath].push(mp.permission.code);
        }
      }
    }

    dto.permissions = permissions;

    return dto;
  }
}
