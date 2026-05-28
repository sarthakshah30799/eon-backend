import { IsEmail, IsString, MinLength, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserStatus } from '../user.entity';

export class CreateUserDto {
  @ApiProperty({ description: 'Unique user code', example: 'USR-001' })
  @IsString()
  @MinLength(1)
  userCode: string;

  @ApiProperty({ description: 'User password', example: 'password123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ description: 'First name', example: 'John' })
  @IsString()
  @MinLength(1)
  firstName: string;

  @ApiProperty({ description: 'Last name', example: 'Doe' })
  @IsString()
  @MinLength(1)
  lastName: string;

  @ApiProperty({ description: 'Email address', example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Country code (2 chars)', example: 'IN', required: false })
  @IsString()
  @IsOptional()
  countryCode?: string;

  @ApiProperty({ description: 'Phone number', example: '9876543210' })
  @IsString()
  phoneNumber: string;

  @ApiProperty({ description: 'User status', enum: UserStatus, required: false })
  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;

  @ApiProperty({ description: 'Is head office user', example: false, required: false })
  @IsBoolean()
  @IsOptional()
  isHo?: boolean;
}
