import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export enum BookingMasterType {
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME',
}

export class CreateExpenseIncomeBookingMasterDto {
  @ApiProperty({ description: 'Type of booking master', enum: BookingMasterType, example: BookingMasterType.EXPENSE })
  @IsEnum(BookingMasterType)
  type: BookingMasterType;

  @ApiPropertyOptional({ description: 'Interstate transaction flag', default: false })
  @IsBoolean()
  @IsOptional()
  interstateTransaction?: boolean;

  @ApiProperty({ description: 'Unique code for master', example: 'EXP-001' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @ApiPropertyOptional({ description: 'Description of master' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({ description: 'Applicable to customer', default: false })
  @IsBoolean()
  @IsOptional()
  applicableCustomer?: boolean;

  @ApiPropertyOptional({ description: 'Applicable to vendor', default: false })
  @IsBoolean()
  @IsOptional()
  applicableVendor?: boolean;

  @ApiPropertyOptional({ description: 'Applicable to employee', default: false })
  @IsBoolean()
  @IsOptional()
  applicableEmployee?: boolean;

  @ApiPropertyOptional({ description: 'Applicable to agent', default: false })
  @IsBoolean()
  @IsOptional()
  applicableAgent?: boolean;

  @ApiPropertyOptional({
    description: "Applicable to Card issuer",
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  applicableCardIssuer?: boolean;

  @ApiPropertyOptional({ description: 'Is active flag', default: true })
  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @ApiPropertyOptional({ description: 'Allow receive/payment flag', default: false })
  @IsBoolean()
  @IsOptional()
  allowRecPay?: boolean;

  @ApiPropertyOptional({ description: 'Total GST percentage', default: 0.00 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0)
  totalGst?: number;

  @ApiPropertyOptional({ description: 'TDS applicable flag', default: false })
  @IsBoolean()
  @IsOptional()
  tdsApplicable?: boolean;

  @ApiPropertyOptional({ description: 'TDS value percentage', default: 0.00 })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0)
  tdsValue?: number;

  @ApiPropertyOptional({ description: 'TDS account profile UUID' })
  @IsUUID()
  @IsOptional()
  tdsAccountId?: string | null;

  @ApiPropertyOptional({ description: 'Valid from date', example: '2026-01-01' })
  @IsDateString()
  @IsOptional()
  from?: string | null;

  @ApiPropertyOptional({ description: 'Valid to date', example: '2026-12-31' })
  @IsDateString()
  @IsOptional()
  to?: string | null;
}
