import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { CurrencyRateProvider } from '../currency-rates.enums';

export class CreateCurrencyRateDto {
  @ApiProperty()
  @IsUUID()
  currencyId: string;

  @ApiProperty({ enum: CurrencyRateProvider })
  @IsString()
  @IsIn(Object.values(CurrencyRateProvider))
  provider: CurrencyRateProvider;

  @ApiPropertyOptional({ description: 'Manual base rate for forex; copied to buy and sale when provided' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'baseRate must be a valid decimal number' })
  baseRate?: string;

  @ApiPropertyOptional({ description: 'Base buy rate for ticker' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'baseBuyRate must be a valid decimal number' })
  baseBuyRate?: string;

  @ApiPropertyOptional({ description: 'Base sale rate for ticker' })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'baseSaleRate must be a valid decimal number' })
  baseSaleRate?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
