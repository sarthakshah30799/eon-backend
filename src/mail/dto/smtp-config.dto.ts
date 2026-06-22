import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SaveSmtpConfigDto {
  @ApiProperty({ example: 'smtp.gmail.com' })
  @IsString()
  @IsNotEmpty()
  host: string;

  @ApiProperty({ example: 587 })
  @IsInt()
  @IsNotEmpty()
  port: number;

  @ApiProperty({ example: 'username@gmail.com' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'mypassword', required: false })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiProperty({ example: 'no-reply@yourdomain.com', required: false })
  @IsString()
  @IsOptional()
  senderEmail?: string;
}

export class SmtpConfigResponseDto {
  @ApiProperty()
  host: string;

  @ApiProperty()
  port: number;

  @ApiProperty()
  username: string;

  @ApiProperty()
  hasPassword: boolean;

  @ApiProperty({ required: false })
  senderEmail?: string;
}
