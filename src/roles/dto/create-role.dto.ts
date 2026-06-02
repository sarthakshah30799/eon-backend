import { IsString, IsNotEmpty, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty({ description: 'User Group Code', example: 'ADMIN', maxLength: 20 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  userGroupCode: string;

  @ApiProperty({ description: 'User Group Name', example: 'Administrator', maxLength: 250 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  userGroupName: string;

  @ApiProperty({ default: false, required: false })
  @IsBoolean()
  @IsOptional()
  isAdminGrp?: boolean;

  @ApiProperty({ default: false, required: false })
  @IsBoolean()
  @IsOptional()
  isMdGroup?: boolean;

  @ApiProperty({ default: false, required: false })
  @IsBoolean()
  @IsOptional()
  isComplianceGrp?: boolean;

  @ApiProperty({ default: false, required: false })
  @IsBoolean()
  @IsOptional()
  isSrFinanceGrp?: boolean;

  @ApiProperty({ default: false, required: false })
  @IsBoolean()
  @IsOptional()
  isFinanceGrp?: boolean;

  @ApiProperty({ default: false, required: false })
  @IsBoolean()
  @IsOptional()
  isBrnMgrGrp?: boolean;

  @ApiProperty({ default: false, required: false })
  @IsBoolean()
  @IsOptional()
  isExecutiveGrp?: boolean;

  @ApiProperty({ default: false, required: false })
  @IsBoolean()
  @IsOptional()
  isCardStkGrp?: boolean;

  @ApiProperty({ default: false, required: false })
  @IsBoolean()
  @IsOptional()
  isDeliveryBoyGrp?: boolean;

  @ApiProperty({ default: false, required: false })
  @IsBoolean()
  @IsOptional()
  isCashierGrp?: boolean;

  @ApiProperty({ default: false, required: false })
  @IsBoolean()
  @IsOptional()
  isSalesMgrGrp?: boolean;

  @ApiProperty({ default: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ default: false, required: false })
  @IsBoolean()
  @IsOptional()
  isAeonAccess?: boolean;

  @ApiProperty({ default: false, required: false })
  @IsBoolean()
  @IsOptional()
  isDelPortalAccess?: boolean;

  @ApiProperty({ default: false, required: false })
  @IsBoolean()
  @IsOptional()
  isDelAppAccess?: boolean;
}
