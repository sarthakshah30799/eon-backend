import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../role.entity';

export class RoleResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() code: string;
  @ApiProperty() name: string;
  @ApiProperty() isAdmin: boolean;
  @ApiProperty() isMd: boolean;
  @ApiProperty() isCompliance: boolean;
  @ApiProperty() isSrFinance: boolean;
  @ApiProperty() isFinance: boolean;
  @ApiProperty() isBrnMgr: boolean;
  @ApiProperty() isHoStaff: boolean;
  @ApiProperty() isExecutive: boolean;
  @ApiProperty() isCardStk: boolean;
  @ApiProperty() isDeliveryBoy: boolean;
  @ApiProperty() isCashier: boolean;
  @ApiProperty() isSalesMgr: boolean;
  @ApiProperty() isActive: boolean;
  @ApiProperty() isAeonAccess: boolean;
  @ApiProperty() isDelPortalAccess: boolean;
  @ApiProperty() isDelAppAccess: boolean;
  @ApiProperty({ required: false, type: Object })
  permissions?: Record<string, Record<string, boolean>>;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static fromEntity(entity: Role): RoleResponseDto {
    const dto = new RoleResponseDto();
    dto.id = entity.id;
    dto.code = entity.code;
    dto.name = entity.name;
    dto.isAdmin = entity.isAdmin;
    dto.isMd = entity.isMd;
    dto.isCompliance = entity.isCompliance;
    dto.isSrFinance = entity.isSrFinance;
    dto.isFinance = entity.isFinance;
    dto.isBrnMgr = entity.isBrnMgr;
    dto.isHoStaff = entity.isHoStaff;
    dto.isExecutive = entity.isExecutive;
    dto.isCardStk = entity.isCardStk;
    dto.isDeliveryBoy = entity.isDeliveryBoy;
    dto.isCashier = entity.isCashier;
    dto.isSalesMgr = entity.isSalesMgr;
    dto.isActive = entity.isActive;
    dto.isAeonAccess = entity.isAeonAccess;
    dto.isDelPortalAccess = entity.isDelPortalAccess;
    dto.isDelAppAccess = entity.isDelAppAccess;

    const permissions: Record<string, Record<string, boolean>> = {};
    for (const menuPermission of entity.menuPermissions ?? []) {
      if (!menuPermission.menu || !menuPermission.permission) {
        continue;
      }

      const menuId = menuPermission.menu.id;
      const permCode = menuPermission.permission.code;

      if (!permissions[menuId]) {
        permissions[menuId] = {
          add: false,
          modify: false,
          delete: false,
          view: false,
          export: false,
          authorized: false,
          rejected: false,
        };
      }

      permissions[menuId][permCode] = true;
    }

    dto.permissions = permissions;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
