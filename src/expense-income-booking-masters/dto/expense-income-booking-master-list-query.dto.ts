import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BookingMasterType } from './create-expense-income-booking-master.dto';

export class ExpenseIncomeBookingMasterListQueryDto {
  @ApiPropertyOptional({ enum: BookingMasterType, description: 'Filter by type' })
  @IsEnum(BookingMasterType)
  @IsOptional()
  type?: BookingMasterType;

  @ApiPropertyOptional({ description: 'Global search across code and description' })
  @IsString()
  @IsOptional()
  search?: string;
}
