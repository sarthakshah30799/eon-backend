import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';

export enum TransactionPrintCopyType {
  CUSTOMER_COPY = 'CUSTOMER_COPY',
  DUPLICATE_COPY = 'DUPLICATE_COPY',
}

export class RecordTransactionPrintDto {
  @ApiProperty({ enum: TransactionPrintCopyType, required: false })
  @IsEnum(TransactionPrintCopyType)
  @IsOptional()
  copyType?: TransactionPrintCopyType;

  @ApiPropertyOptional({ description: 'Customer email address to send the copy to' })
  @IsString()
  @IsOptional()
  @IsEmail()
  recipientEmail?: string;

  @ApiPropertyOptional({ description: 'Email subject' })
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiPropertyOptional({ description: 'Plain text fallback for email' })
  @IsString()
  @IsOptional()
  text?: string;

  @ApiPropertyOptional({ description: 'Printable HTML for email or archive' })
  @IsString()
  @IsOptional()
  html?: string;

  @ApiPropertyOptional({ description: 'Whether the same content should be emailed' })
  @IsBoolean()
  @IsOptional()
  sendEmail?: boolean;
}
