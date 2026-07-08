import { IsString, IsNotEmpty, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ description: 'Email address of the user requesting password reset', example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Email address of the user', example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Password reset token from console logs', example: 'a1b2c3d4...' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ description: 'New password', example: 'newsecurepassword123' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class SetupPasswordDto {
  @ApiProperty({ description: 'New password', example: 'newsecurepassword123' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
