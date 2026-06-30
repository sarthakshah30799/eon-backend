import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { CurrencyRateProvider } from '../currency-rates.enums';

export class PreviewCurrencyRateDto {
  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty()
  @IsUUID()
  currencyId: string;

  @ApiProperty({ enum: CurrencyRateProvider })
  @IsString()
  @IsIn(Object.values(CurrencyRateProvider))
  provider: CurrencyRateProvider;

  @ApiProperty()
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'baseBuyRate must be a valid decimal number' })
  baseBuyRate?: string;

  @ApiProperty()
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'baseSaleRate must be a valid decimal number' })
  baseSaleRate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'baseRate must be a valid decimal number' })
  baseRate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
