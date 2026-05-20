import { IsEmail, IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginUserDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
    required: false,
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({
    description: 'Country code for mobile number',
    example: '+1',
    required: false,
  })
  @IsString()
  @IsOptional()
  countryCode?: string;

  @ApiProperty({
    description: 'Mobile number',
    example: '1234567890',
    required: false,
  })
  @IsString()
  @IsOptional()
  mobileNumber?: string;

  @ApiProperty({
    description: 'User password',
    example: 'password123',
  })
  @IsString()
  password: string;
}
