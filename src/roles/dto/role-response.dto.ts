import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../role.entity';

export class RoleResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() userGroupCode: string;
  @ApiProperty() userGroupName: string;
  @ApiProperty() isAdminGrp: boolean;
  @ApiProperty() isMdGroup: boolean;
  @ApiProperty() isComplianceGrp: boolean;
  @ApiProperty() isSrFinanceGrp: boolean;
  @ApiProperty() isFinanceGrp: boolean;
  @ApiProperty() isBrnMgrGrp: boolean;
  @ApiProperty() isExecutiveGrp: boolean;
  @ApiProperty() isCardStkGrp: boolean;
  @ApiProperty() isDeliveryBoyGrp: boolean;
  @ApiProperty() isCashierGrp: boolean;
  @ApiProperty() isSalesMgrGrp: boolean;
  @ApiProperty() isActive: boolean;
  @ApiProperty() isAeonAccess: boolean;
  @ApiProperty() isDelPortalAccess: boolean;
  @ApiProperty() isDelAppAccess: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static fromEntity(entity: Role): RoleResponseDto {
    const dto = new RoleResponseDto();
    dto.id = entity.id;
    dto.userGroupCode = entity.userGroupCode;
    dto.userGroupName = entity.userGroupName;
    dto.isAdminGrp = entity.isAdminGrp;
    dto.isMdGroup = entity.isMdGroup;
    dto.isComplianceGrp = entity.isComplianceGrp;
    dto.isSrFinanceGrp = entity.isSrFinanceGrp;
    dto.isFinanceGrp = entity.isFinanceGrp;
    dto.isBrnMgrGrp = entity.isBrnMgrGrp;
    dto.isExecutiveGrp = entity.isExecutiveGrp;
    dto.isCardStkGrp = entity.isCardStkGrp;
    dto.isDeliveryBoyGrp = entity.isDeliveryBoyGrp;
    dto.isCashierGrp = entity.isCashierGrp;
    dto.isSalesMgrGrp = entity.isSalesMgrGrp;
    dto.isActive = entity.isActive;
    dto.isAeonAccess = entity.isAeonAccess;
    dto.isDelPortalAccess = entity.isDelPortalAccess;
    dto.isDelAppAccess = entity.isDelAppAccess;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
