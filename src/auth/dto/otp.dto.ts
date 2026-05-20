import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendOtpDto {
  @ApiProperty({ description: 'Country Code', example: '+1' })
  @IsString()
  @IsNotEmpty()
  countryCode: string;

  @ApiProperty({ description: 'Mobile Number', example: '1234567890' })
  @IsString()
  @IsNotEmpty()
  mobileNumber: string;
}

export class VerifyOtpDto {
  @ApiProperty({ description: 'Country Code', example: '+1' })
  @IsString()
  @IsNotEmpty()
  countryCode: string;

  @ApiProperty({ description: 'Mobile Number', example: '1234567890' })
  @IsString()
  @IsNotEmpty()
  mobileNumber: string;

  @ApiProperty({ description: 'OTP Code', example: '123456' })
  @IsString()
  @IsNotEmpty()
  otp: string;
}
