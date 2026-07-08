import { IsString, IsNotEmpty, IsOptional, IsUUID, IsInt, IsBoolean, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMenuDto {
  @ApiProperty({ description: 'Marks the menu as an admin menu', example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isAdmin?: boolean;

  @ApiProperty({ description: 'Menu item name', example: 'Company Profile' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Route path', example: '/admin/company-profile', required: false })
  @IsString()
  @IsOptional()
  path?: string;

  @ApiProperty({ description: 'Icon identifier', required: false })
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiProperty({ description: 'Parent menu ID (UUID)', required: false, nullable: true })
  @ValidateIf(o => o.parentId != null)  // skip UUID validation when explicitly null
  @IsUUID()
  @IsOptional()
  parentId?: string | null;

  @ApiProperty({ description: 'Sort order', example: 0, required: false })
  @IsInt()
  @IsOptional()
  sortOrder?: number;

  @ApiProperty({ description: 'Is active', example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
