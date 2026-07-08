import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SendMailDto {
  @ApiProperty({ example: 'from@example.com', required: false })
  @IsString()
  @IsOptional()
  from?: string;

  @ApiProperty({ example: 'recipient@example.com' })
  @IsString()
  @IsNotEmpty()
  to: string;

  @ApiProperty({ example: 'cc@example.com', required: false })
  @IsString()
  @IsOptional()
  cc?: string;

  @ApiProperty({ example: 'bcc@example.com', required: false })
  @IsString()
  @IsOptional()
  bcc?: string;

  @ApiProperty({ example: 'Hello' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiProperty({ example: 'Body content' })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiProperty({ example: '<p>Body content</p>', required: false })
  @IsString()
  @IsOptional()
  html?: string;
}
