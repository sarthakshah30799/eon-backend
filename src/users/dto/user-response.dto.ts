import { User } from '../user.entity';
import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ description: 'User ID (UUID)' })
  id: string;

  @ApiProperty({ description: 'User Code', example: 'USR-001' })
  userCode: string;

  @ApiProperty({ description: 'User Name', example: 'Sarthak Kumar' })
  userName: string;

  @ApiProperty({ description: 'User Group Code', required: false })
  userGroupCode: string;

  @ApiProperty({ description: 'Contact No', required: false })
  contactNo: string;

  @ApiProperty({ description: 'Email ID', example: 'user@example.com' })
  emailId: string;

  @ApiProperty({ description: 'Employee No', required: false })
  employeeNo: string;

  @ApiProperty({ description: 'Designation', required: false })
  designation: string;

  @ApiProperty({ description: 'Branch Code', required: false })
  branchCode: string;

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

  @ApiProperty({ description: 'Role name (User Group Name)', required: false })
  roleName?: string;

  @ApiProperty({ description: 'Branch ID (UUID)', required: false })
  branchId?: string;

  @ApiProperty({ description: 'Counter ID (UUID)', required: false })
  counterId?: string;

  @ApiProperty({ description: 'Counter code', required: false })
  counterCode?: string;

  @ApiProperty({ description: 'Permissions map', required: false })
  permissions?: Record<string, string[]>;

  static fromEntity(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.userCode = user.userCode;
    dto.userName = user.userName;
    dto.userGroupCode = user.userGroupCode;
    dto.contactNo = user.contactNo;
    dto.emailId = user.emailId;
    dto.employeeNo = user.employeeNo;
    dto.designation = user.designation;
    dto.branchCode = user.branchCode;
    dto.userLicNo = user.userLicNo;
    dto.isActive = user.isActive;
    dto.lastLoginDate = user.lastLoginDate;
    dto.isLocked = user.isLocked;
    dto.isDormant = user.isDormant;
    dto.createdAt = user.createdAt;
    dto.updatedAt = user.updatedAt;

    const permissions: Record<string, string[]> = {};
    if (user.userRoles && user.userRoles.length > 0) {
      const userRole = user.userRoles[0];
      dto.roleId = userRole.role?.id || null;
      dto.roleName = userRole.role?.userGroupName || null;
      dto.branchId = userRole.branch?.id || null;
      dto.counterId = userRole.counter?.id || null;
      dto.counterCode = userRole.counter ? String(userRole.counter.counterNo) : null;

      if (userRole.role && userRole.role.menuPermissions) {
        for (const mp of userRole.role.menuPermissions) {
          if (mp.menu && mp.permission) {
            const menuPath = mp.menu.path || mp.menu.name;
            if (!permissions[menuPath]) {
              permissions[menuPath] = [];
            }
            permissions[menuPath].push(mp.permission.code);
          }
        }
      }
    }
    dto.permissions = permissions;

    return dto;
  }
}
