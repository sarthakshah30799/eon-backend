import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ description: 'User Code', example: 'USR-001', maxLength: 20 })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  code: string;

  @ApiProperty({ description: 'User password', example: 'password123', minLength: 6, required: false })
  @IsString()
  @MinLength(6)
  @IsOptional()
  password?: string;

  @ApiProperty({ description: 'User Name', example: 'Sarthak Kumar', maxLength: 250 })
  @IsString()
  @MinLength(1)
  @MaxLength(250)
  name: string;

  @ApiProperty({ description: 'Contact No', required: false })
  @IsString()
  @IsOptional()
  contactNo?: string;

  @ApiProperty({ description: 'Email', example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Employee No', required: false })
  @IsString()
  @IsOptional()
  employeeNo?: string;

  @ApiProperty({ description: 'Designation', required: false })
  @IsString()
  @IsOptional()
  designation?: string;

  @ApiProperty({ description: 'User Lic No', required: false })
  @IsString()
  @IsOptional()
  userLicNo?: string;

  @ApiProperty({ description: 'Is Active', default: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ description: 'Is Locked', default: false, required: false })
  @IsBoolean()
  @IsOptional()
  isLocked?: boolean;

  @ApiProperty({ description: 'Is Dormant', default: false, required: false })
  @IsBoolean()
  @IsOptional()
  isDormant?: boolean;

  @ApiProperty({ description: 'Role ID (UUID)', required: false })
  @IsString()
  @IsOptional()
  roleId?: string;

  @ApiProperty({ description: 'Branch ID (UUID)', required: false })
  @IsString()
  @IsOptional()
  branchId?: string;

  @ApiProperty({ description: 'Counter ID (UUID)', required: false })
  @IsString()
  @IsOptional()
  counterId?: string;
}
