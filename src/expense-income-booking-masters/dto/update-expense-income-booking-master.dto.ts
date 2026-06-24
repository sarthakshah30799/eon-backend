import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { BookingMasterType } from './create-expense-income-booking-master.dto';

export class UpdateExpenseIncomeBookingMasterDto {
  @ApiPropertyOptional({ description: 'Type of booking master', enum: BookingMasterType })
  @IsEnum(BookingMasterType)
  @IsOptional()
  type?: BookingMasterType;

  @ApiPropertyOptional({ description: 'Interstate transaction flag' })
  @IsBoolean()
  @IsOptional()
  interstateTransaction?: boolean;

  @ApiPropertyOptional({ description: 'Code for master' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional({ description: 'Description of master' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({ description: 'Applicable to customer' })
  @IsBoolean()
  @IsOptional()
  applicableCustomer?: boolean;

  @ApiPropertyOptional({ description: 'Applicable to vendor' })
  @IsBoolean()
  @IsOptional()
  applicableVendor?: boolean;

  @ApiPropertyOptional({ description: 'Applicable to employee' })
  @IsBoolean()
  @IsOptional()
  applicableEmployee?: boolean;

  @ApiPropertyOptional({ description: 'Applicable to agent' })
  @IsBoolean()
  @IsOptional()
  applicableAgent?: boolean;

  @ApiPropertyOptional({ description: "Applicable to Card issuer" })
  @IsBoolean()
  @IsOptional()
  applicableCardIssuer?: boolean;

  @ApiPropertyOptional({ description: 'Is active flag' })
  @IsBoolean()
  @IsOptional()
  active?: boolean;

  @ApiPropertyOptional({ description: 'Allow receive/payment flag' })
  @IsBoolean()
  @IsOptional()
  allowRecPay?: boolean;

  @ApiPropertyOptional({ description: 'Total GST percentage' })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0)
  totalGst?: number;

  @ApiPropertyOptional({ description: 'TDS applicable flag' })
  @IsBoolean()
  @IsOptional()
  tdsApplicable?: boolean;

  @ApiPropertyOptional({ description: 'TDS value percentage' })
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
